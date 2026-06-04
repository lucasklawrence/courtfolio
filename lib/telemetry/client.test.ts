// @vitest-environment node
/**
 * Tests for the vendored telemetry client — adapted from the upstream
 * suite in `lucasklawrence/life@packages/telemetry-ts` (`src/index.test.ts`)
 * plus coverage for this repo's local divergences (`GCP_SA_KEY` inline
 * credentials).
 *
 * `@google-cloud/pubsub` is mocked — no live network, no real GCP calls. The
 * client is dynamically re-imported per test (vi.resetModules) so its cached
 * publisher/topic state starts clean each time.
 *
 * Runs in the `node` environment (docblock above): under jsdom the client's
 * browser guard would correctly no-op every call, which is itself asserted in
 * one test — but the rest of the suite needs the server path.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Client from './client'

// The canonical envelope keys (PRD §2). Tests assert producers emit exactly these.
const REQUIRED_KEYS = [
  'event_id',
  'event_time',
  'schema_version',
  'source',
  'project',
  'environment',
  'host',
  'session_id',
  'event_type',
  'name',
  'status',
  'duration_ms',
  'value',
  'unit',
  'attributes',
].sort()

// Shared recorder the mocked @google-cloud/pubsub writes into. vi.hoisted lets
// the mock factory (hoisted above imports) reference it safely.
const rec = vi.hoisted(() => ({
  constructed: [] as Array<Record<string, unknown>>,
  published: [] as Buffer[],
  closed: 0,
  mode: 'ok' as 'ok' | 'raise',
  // When true, the next PubSub construction throws once (simulates a transient
  // init failure) so we can assert the client retries on the following emit.
  failNextConstruct: false,
  reset() {
    this.constructed = []
    this.published = []
    this.closed = 0
    this.mode = 'ok'
    this.failNextConstruct = false
  },
}))

vi.mock('@google-cloud/pubsub', () => {
  class FakeTopic {
    constructor(public name: string) {}
    publishMessage(message: { data: Buffer }): Promise<string> {
      // Real @google-cloud/pubsub rejects a promise on failure (it does not throw
      // synchronously); mirror that so the "never throws" guarantee is tested
      // against the realistic failure shape.
      if (rec.mode === 'raise') {
        return Promise.reject(new Error('pubsub down'))
      }
      rec.published.push(message.data)
      return Promise.resolve('msg-id')
    }
  }
  class PubSub {
    constructor(opts: Record<string, unknown> = {}) {
      if (rec.failNextConstruct) {
        rec.failNextConstruct = false
        throw new Error('init boom')
      }
      rec.constructed.push(opts)
    }
    topic(name: string) {
      return new FakeTopic(name)
    }
    close() {
      rec.closed += 1
      return Promise.resolve()
    }
  }
  return { PubSub }
})

async function loadClient(): Promise<typeof Client> {
  // Fresh module instance so module-level cached state resets between tests.
  vi.resetModules()
  return import('./client')
}

function enable() {
  process.env.GOOGLE_CLOUD_PROJECT = 'test-proj'
  process.env.TELEMETRY_PROJECT = 'unit-tests'
}

function lastEnvelope(): Record<string, unknown> {
  const data = rec.published[rec.published.length - 1]
  return JSON.parse(data.toString('utf-8'))
}

beforeEach(() => {
  rec.reset()
  for (const v of [
    'TELEMETRY_DISABLED',
    'GOOGLE_CLOUD_PROJECT',
    'TELEMETRY_PROJECT',
    'TELEMETRY_ENV',
    'GCP_SA_KEY',
  ]) {
    delete process.env[v]
  }
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('telemetry client', () => {
  it('is a full no-op when TELEMETRY_DISABLED is set', async () => {
    process.env.TELEMETRY_DISABLED = '1'
    const t = await loadClient()

    expect(t.isEnabled()).toBe(false)
    t.emitEvent('req', { durationMs: 5 })
    t.emitMetric('weight_room_set_logged', 1.0)
    await t.flush()

    // No client constructed, nothing published, and flush() stays inert (never
    // touches a client / credentials on the disabled path).
    expect(rec.constructed).toHaveLength(0)
    expect(rec.published).toHaveLength(0)
    expect(rec.closed).toBe(0)
  })

  it('no-ops in a browser-like environment (server-only guard)', async () => {
    enable()
    const g = globalThis as unknown as { window?: unknown }
    g.window = {}
    try {
      const t = await loadClient()
      t.emitEvent('from-browser')
      t.emitMetric('from-browser', 1.0)
      await t.flush()

      // The credential-reading Pub/Sub client must never be constructed client-side.
      expect(rec.constructed).toHaveLength(0)
      expect(rec.published).toHaveLength(0)
    } finally {
      delete g.window
    }
  })

  it('retries init on the next emit after a transient init failure', async () => {
    enable()
    rec.failNextConstruct = true // first construction throws
    const t = await loadClient()

    t.emitEvent('first') // init fails -> no-op, cached promise cleared
    await t.flush()
    expect(rec.published).toHaveLength(0)

    t.emitEvent('second') // should retry init and succeed
    await t.flush()
    expect(rec.published).toHaveLength(1)
    expect(JSON.parse(rec.published[0].toString('utf-8')).name).toBe('second')
  })

  it('emits an event envelope with the exact canonical shape', async () => {
    enable()
    const t = await loadClient()

    t.emitEvent('GET /api/admin/check', {
      status: 'ok',
      durationMs: 42,
      attributes: { k: 'v' },
    })
    await t.flush()

    expect(rec.constructed).toHaveLength(1)
    const env = lastEnvelope()
    expect(Object.keys(env).sort()).toEqual(REQUIRED_KEYS)
    expect(env.source).toBe('app')
    expect(env.schema_version).toBe(1)
    expect(env.event_type).toBe('event')
    expect(env.name).toBe('GET /api/admin/check')
    expect(env.project).toBe('unit-tests')
    expect(env.status).toBe('ok')
    expect(env.duration_ms).toBe(42)
    // attributes is a JSON-encoded string (matches the events.attributes STRING column)
    expect(typeof env.attributes).toBe('string')
    expect(JSON.parse(env.attributes as string)).toEqual({ k: 'v' })
  })

  it('emits a metric envelope with the exact canonical shape', async () => {
    enable()
    const t = await loadClient()

    t.emitMetric('weight_room_set_logged', 10, { unit: 'reps' })
    await t.flush()

    const env = lastEnvelope()
    expect(Object.keys(env).sort()).toEqual(REQUIRED_KEYS)
    expect(env.source).toBe('app')
    expect(env.event_type).toBe('metric')
    expect(env.name).toBe('weight_room_set_logged')
    expect(env.value).toBe(10)
    expect(env.unit).toBe('reps')
    // no attributes passed -> JSON-encoded empty object, never a raw object
    expect(env.attributes).toBe('{}')
  })

  it('serializes attributes to a JSON string, not a nested object', async () => {
    enable()
    const t = await loadClient()

    t.emitMetric('sync_lag_seconds', 3, {
      unit: 'seconds',
      attributes: { region: 'us', nested: { a: 1 } },
    })
    await t.flush()

    const env = lastEnvelope()
    expect(typeof env.attributes).toBe('string')
    expect(JSON.parse(env.attributes as string)).toEqual({
      region: 'us',
      nested: { a: 1 },
    })
  })

  it('never throws into the caller when the client errors', async () => {
    enable()
    rec.mode = 'raise'
    const t = await loadClient()

    // Best-effort guarantee: a failing client must not propagate to the caller.
    t.emitEvent('boom')
    t.emitMetric('boom', 1.0)
    await expect(t.flush()).resolves.toBeUndefined()
  })

  it('flush drains queued publishes and closes the client', async () => {
    enable()
    const t = await loadClient()

    t.emitEvent('a')
    t.emitMetric('b', 1.0)
    await t.flush()

    expect(rec.published).toHaveLength(2) // both publishes happened
    expect(rec.closed).toBe(1) // flush closed the client
  })

  it('generates a unique event_id per emission', async () => {
    enable()
    const t = await loadClient()

    t.emitEvent('a')
    t.emitEvent('b')
    await t.flush()

    const ids = new Set(rec.published.map(d => JSON.parse(d.toString('utf-8')).event_id))
    expect(ids.size).toBe(2)
  })

  // ── Local divergence: GCP_SA_KEY inline credentials (Vercel) ─────────

  it('passes GCP_SA_KEY credentials to the Pub/Sub constructor', async () => {
    enable()
    process.env.GCP_SA_KEY = JSON.stringify({
      client_email: 'sa@test-proj.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
      project_id: 'key-proj',
    })
    const t = await loadClient()

    t.emitEvent('with-inline-creds')
    await t.flush()

    expect(rec.constructed).toHaveLength(1)
    const opts = rec.constructed[0] as {
      projectId?: string
      credentials?: { client_email: string; private_key: string }
    }
    expect(opts.credentials?.client_email).toBe('sa@test-proj.iam.gserviceaccount.com')
    expect(opts.credentials?.private_key).toContain('BEGIN PRIVATE KEY')
    // GOOGLE_CLOUD_PROJECT wins over the key's own project_id.
    expect(opts.projectId).toBe('test-proj')
    expect(rec.published).toHaveLength(1)
  })

  it("falls back to the key's project_id when GOOGLE_CLOUD_PROJECT is unset", async () => {
    process.env.TELEMETRY_PROJECT = 'unit-tests'
    process.env.GCP_SA_KEY = JSON.stringify({
      client_email: 'sa@key-proj.iam.gserviceaccount.com',
      private_key: 'pk',
      project_id: 'key-proj',
    })
    const t = await loadClient()

    t.emitEvent('project-from-key')
    await t.flush()

    expect(rec.constructed).toHaveLength(1)
    expect((rec.constructed[0] as { projectId?: string }).projectId).toBe('key-proj')
  })

  it('falls back to ADC when GCP_SA_KEY is malformed or incomplete', async () => {
    enable()
    process.env.GCP_SA_KEY = 'not json at all'
    let t = await loadClient()
    t.emitEvent('malformed-key')
    await t.flush()

    // Constructed without credentials — ADC path.
    expect(rec.constructed).toHaveLength(1)
    expect(rec.constructed[0]).not.toHaveProperty('credentials')

    // A structurally-valid JSON missing the key fields is treated the same.
    process.env.GCP_SA_KEY = JSON.stringify({ client_email: 'sa@x' }) // no private_key
    t = await loadClient()
    t.emitEvent('incomplete-key')
    await t.flush()
    expect(rec.constructed).toHaveLength(2)
    expect(rec.constructed[1]).not.toHaveProperty('credentials')
  })
})
