/**
 * Personal-telemetry client — vendored from
 * `lucasklawrence/life@packages/telemetry-ts` (`src/index.ts`, v0.1.0).
 *
 * Vendored because this repo uses npm, which cannot install a package from a
 * git subdirectory (the upstream README documents pnpm/yarn-only git installs).
 * Swap to the `personal-telemetry-ts` npm package if/when it is published.
 *
 * Publishes the canonical event envelope (`docs/personal-telemetry-PRD.md` §2
 * in lucasklawrence/life) to the Pub/Sub topic `telemetry`, which a BigQuery
 * subscription writes straight into `koy-engineering.telemetry.events`.
 *
 * Local divergences from upstream (keep this list current):
 * 1. `import 'server-only'` — build-time guard matching this repo's
 *    convention for credential-touching modules (see `lib/auth/*`,
 *    `lib/supabase/admin`).
 * 2. `GCP_SA_KEY` support — Vercel cannot provide
 *    `GOOGLE_APPLICATION_CREDENTIALS` as a file path, so when `GCP_SA_KEY`
 *    holds a service-account key JSON we pass its `client_email` /
 *    `private_key` directly to the Pub/Sub constructor.
 * 3. `host` falls back to `VERCEL_REGION` (e.g. `iad1`) before `unknown` —
 *    Vercel functions set neither `HOSTNAME` nor `COMPUTERNAME`.
 * 4. The exit-flush hook dedupes via a `globalThis` key instead of a
 *    module-level flag — module-level state is re-created on every fresh
 *    module instance (Next dev HMR, vitest `resetModules`), which would
 *    stack one `beforeExit` listener per instance and trip Node's
 *    MaxListenersExceededWarning.
 *
 * **Server-only.** This module lazily imports `@google-cloud/pubsub`, which
 * reads service-account credentials. It must never be bundled into the
 * browser. As a belt-and-braces guard (upstream behavior), every emit call
 * also no-ops when it detects a browser-like global.
 *
 * Design notes (mirrors the upstream/Python clients):
 * - Long-lived servers call {@link emitEvent} / {@link emitMetric} directly;
 *   the Pub/Sub client batches internally and {@link flush} drains on
 *   shutdown.
 * - Emission is **best-effort**: every public call swallows its own errors so
 *   telemetry can never throw into a caller's request path.
 * - `TELEMETRY_DISABLED=1` makes every call a no-op (tests / CI).
 *
 * Required env: `GOOGLE_CLOUD_PROJECT`, `TELEMETRY_PROJECT`. Optional:
 * `TELEMETRY_ENV` (default `local`), `GCP_SA_KEY` (deployed; see above),
 * `GOOGLE_APPLICATION_CREDENTIALS` (local ADC key-file path).
 */

import 'server-only'

/** Envelope schema version (PRD §2). Bump only in lockstep with upstream. */
export const SCHEMA_VERSION = 1

const TOPIC_NAME = 'telemetry'

/** Low-cardinality dimensions attached to an event; serialized to a JSON string. */
export type Attributes = Record<string, unknown>

/** The canonical event envelope (PRD §2). `attributes` is a JSON-encoded STRING. */
export interface Envelope {
  /** UUIDv4 unique to this emission. */
  event_id: string
  /** RFC3339 UTC timestamp with trailing `Z`. */
  event_time: string
  /** Always {@link SCHEMA_VERSION}. */
  schema_version: number
  /** Always `app` for rows emitted by this client. */
  source: string
  /** Logical project name from `TELEMETRY_PROJECT` (`unknown` if unset). */
  project: string
  /** Deploy environment from `TELEMETRY_ENV` (`local` if unset). */
  environment: string
  /** Emitting host — `HOSTNAME` / `COMPUTERNAME` / `VERCEL_REGION` / `unknown`. */
  host: string
  /** Optional correlation ID grouping related events; null when absent. */
  session_id: string | null
  /** `event` or `metric`. */
  event_type: string
  /** Event/metric name — snake_case for domain names, `METHOD /route` for requests. */
  name: string
  /** Outcome label, e.g. `ok` / `error`; null only when not applicable. */
  status: string | null
  /** Request/operation duration in milliseconds; null when not measured. */
  duration_ms: number | null
  /** Metric sample value (events default to 1.0). */
  value: number
  /** Unit for {@link Envelope.value}, e.g. `count`, `reps`, `ms`. */
  unit: string
  /** JSON-encoded string (never a nested object — see PRD §2). */
  attributes: string
}

/** Options for {@link emitEvent}. */
export interface EmitEventOptions {
  /** Outcome label; defaults to `ok`. */
  status?: string
  /** Duration in milliseconds; omitted → null. */
  durationMs?: number | null
  /** Low-cardinality dimensions; serialized to a JSON string. */
  attributes?: Attributes | null
  /** Correlation ID grouping related events; omitted → null. */
  sessionId?: string | null
}

/** Options for {@link emitMetric}. */
export interface EmitMetricOptions {
  /** Unit for the sample value; defaults to `count`. */
  unit?: string
  /** Low-cardinality dimensions; serialized to a JSON string. */
  attributes?: Attributes | null
}

// Minimal structural types for the bits of @google-cloud/pubsub we use, so the
// module type-checks without pulling the dependency's types into the public API.
interface PubSubTopic {
  publishMessage(message: { data: Buffer }): Promise<string>
}
interface PubSubClient {
  topic(name: string): PubSubTopic
  close(): Promise<void> | void
}

let pubsub: PubSubClient | null = null
let topic: PubSubTopic | null = null
let initPromise: Promise<PubSubTopic | null> | null = null
// We keep each publish() promise so flush() can confirm delivery — publishMessage
// is async and a short-lived process can exit before the batch is sent.
let futures: Promise<unknown>[] = []

/** True unless `TELEMETRY_DISABLED` is set. */
export function isEnabled(): boolean {
  return !process.env.TELEMETRY_DISABLED
}

// Guard against accidental client-side use: if there's a browser-like global,
// stay a no-op so credentials are never touched in the browser.
function isBrowserLike(): boolean {
  // Avoid referencing DOM globals directly (not in the Node lib); probe globalThis.
  return 'window' in globalThis || 'document' in globalThis
}

function now(): string {
  // toISOString() already yields RFC3339 UTC with a trailing "Z".
  return new Date().toISOString()
}

/**
 * Local divergence #2: Vercel env vars are strings, not files, so the
 * deployed service-account key lives in `GCP_SA_KEY` as the raw key JSON.
 * Returns Pub/Sub constructor options carrying those inline credentials, or
 * `{}` to fall back to Application Default Credentials (local dev, where
 * `GOOGLE_APPLICATION_CREDENTIALS` can be a real file path).
 */
function credentialOptions(): Record<string, unknown> {
  const raw = process.env.GCP_SA_KEY
  if (!raw) return {}
  try {
    const key = JSON.parse(raw) as {
      client_email?: string
      private_key?: string
      project_id?: string
    }
    if (!key.client_email || !key.private_key) return {}
    return {
      credentials: { client_email: key.client_email, private_key: key.private_key },
      // The key's own project_id is a sensible fallback when
      // GOOGLE_CLOUD_PROJECT is unset.
      projectId: process.env.GOOGLE_CLOUD_PROJECT ?? key.project_id,
    }
  } catch {
    // Malformed key JSON — fall back to ADC rather than break emission.
    return {}
  }
}

// Local divergence #4: a global (not module-level) registration guard, so
// HMR / test re-instantiations of this module don't stack listeners.
const EXIT_HOOK_KEY = Symbol.for('personal-telemetry.exitFlushRegistered')

// Mirror the Python client's `atexit.register(flush)`: drain queued publishes
// when the event loop empties so short-lived processes don't drop fire-and-forget
// emits. `beforeExit` is the closest analog to atexit — it fires on a natural
// exit (and, like atexit, NOT on process.exit()/signals) and can run async work,
// which keeps the loop alive until the publishes settle.
function registerExitFlush(): void {
  const g = globalThis as { [EXIT_HOOK_KEY]?: boolean }
  if (g[EXIT_HOOK_KEY]) return
  g[EXIT_HOOK_KEY] = true
  process.once('beforeExit', () => {
    void flush()
  })
}

async function getTopic(): Promise<PubSubTopic | null> {
  if (!isEnabled() || isBrowserLike()) return null
  if (topic) return topic
  if (!initPromise) {
    initPromise = (async () => {
      // Imported lazily so the no-op path needs no native deps and the import
      // never reaches a browser bundle.
      const { PubSub } = await import('@google-cloud/pubsub')
      const projectId = process.env.GOOGLE_CLOUD_PROJECT
      pubsub = new PubSub({
        ...(projectId ? { projectId } : {}),
        ...credentialOptions(),
      }) as unknown as PubSubClient
      topic = pubsub.topic(TOPIC_NAME)
      registerExitFlush()
      return topic
    })()
    // If init fails (transient import/auth error) clear the cached promise so the
    // next emit retries — the Python client only caches on success, so without
    // this one early failure would silently no-op telemetry for the whole process.
    initPromise.catch(() => {
      initPromise = null
    })
  }
  return initPromise
}

function envelope(
  eventType: string,
  name: string,
  opts: {
    value?: number
    unit?: string
    status?: string | null
    durationMs?: number | null
    attributes?: Attributes | null
    sessionId?: string | null
  } = {}
): Envelope {
  const {
    value = 1.0,
    unit = 'count',
    status = 'ok',
    durationMs = null,
    attributes = null,
    sessionId = null,
  } = opts
  return {
    event_id: globalThis.crypto.randomUUID(),
    event_time: now(),
    schema_version: SCHEMA_VERSION,
    source: 'app',
    project: process.env.TELEMETRY_PROJECT ?? 'unknown',
    environment: process.env.TELEMETRY_ENV ?? 'local',
    host:
      process.env.HOSTNAME || process.env.COMPUTERNAME || process.env.VERCEL_REGION || 'unknown',
    session_id: sessionId,
    event_type: eventType,
    name,
    status,
    duration_ms: durationMs,
    value,
    unit,
    // JSON-encoded string, not a nested object: the events.attributes column is
    // STRING because Pub/Sub BigQuery subscriptions drop messages that write an
    // object into a JSON column.
    attributes: JSON.stringify(attributes ?? {}),
  }
}

async function publish(env: Envelope): Promise<void> {
  try {
    const t = await getTopic()
    if (!t) return
    await t.publishMessage({ data: Buffer.from(JSON.stringify(env), 'utf-8') })
  } catch {
    // Telemetry is best-effort; never break the caller.
  }
}

function enqueue(env: Envelope): void {
  // Capture the publish promise synchronously so flush() can always await it,
  // even while the lazy Pub/Sub import is still in flight. Each promise removes
  // itself once settled, so `futures` only ever holds in-flight publishes — a
  // long-lived server that emits without flushing won't grow it unboundedly.
  const p = publish(env).finally(() => {
    const i = futures.indexOf(p)
    if (i !== -1) futures.splice(i, 1)
  })
  futures.push(p)
}

/** Emit a gauge/counter sample, e.g. `emitMetric('weight_room_set_logged', 10, { unit: 'reps' })`. */
export function emitMetric(name: string, value: number, opts: EmitMetricOptions = {}): void {
  try {
    enqueue(
      envelope('metric', name, {
        value,
        unit: opts.unit ?? 'count',
        attributes: opts.attributes ?? null,
      })
    )
  } catch {
    // Never throw into the caller, even if envelope construction fails.
  }
}

/** Emit a logical/business/runtime event, e.g. one per inbound request. */
export function emitEvent(name: string, opts: EmitEventOptions = {}): void {
  try {
    enqueue(
      envelope('event', name, {
        status: opts.status ?? 'ok',
        durationMs: opts.durationMs ?? null,
        attributes: opts.attributes ?? null,
        sessionId: opts.sessionId ?? null,
      })
    )
  } catch {
    // Never throw into the caller.
  }
}

/**
 * Block until queued messages are sent, then close the client. Call this before
 * a short-lived process exits so fire-and-forget publishes are not dropped.
 */
export async function flush(): Promise<void> {
  try {
    const pending = futures
    futures = []
    // Each publish() already swallows its own errors, so this never rejects.
    await Promise.all(pending)
    if (pubsub) {
      await pubsub.close()
    }
  } catch {
    // Best-effort: flushing must not throw either.
  } finally {
    pubsub = null
    topic = null
    initPromise = null
  }
}
