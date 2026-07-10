/**
 * The single choke point for model calls. Every panel stage goes through
 * {@link generateStructured}, so tests mock this one function rather than the
 * AI SDK, and any future concern (retries, telemetry, spend caps) has one home.
 *
 * Models are plain gateway strings (`provider/model`), routed through the Vercel
 * AI Gateway by the AI SDK when `AI_GATEWAY_API_KEY` (or Vercel OIDC) is set —
 * one credential for all families. See #234 for the cross-family rationale.
 */
import { generateObject } from 'ai'
import type { ZodType } from 'zod'
import type { ModelLineup } from './types'

/**
 * Default cross-family lineup. Personas run on fast/cheap tiers from three
 * disjoint vendors; the meta-judge uses a stronger model; the verifier uses a
 * different family than most personas for neutrality.
 *
 * Ids are dotted gateway ids verified against
 * `GET https://ai-gateway.vercel.sh/v1/models` — re-check when bumping.
 */
export const DEFAULT_LINEUP: ModelLineup = {
  personas: {
    anthropic: 'anthropic/claude-haiku-4.5',
    openai: 'openai/gpt-5.1-instant',
    google: 'google/gemini-3.5-flash',
  },
  metaJudge: 'anthropic/claude-sonnet-4.6',
  verifier: 'openai/gpt-5.1-instant',
}

/** Arguments for {@link generateStructured}. */
export interface GenerateStructuredArgs<T> {
  /** Gateway model id, e.g. `anthropic/claude-haiku-4.5`. */
  model: string
  /** System prompt establishing role/stance. */
  system: string
  /** The user prompt / task. */
  prompt: string
  /** Zod schema the output must satisfy; the SDK retries the model on mismatch. */
  schema: ZodType<T>
  /** Output-token ceiling for this call (cost guard). Omit for the SDK default. */
  maxOutputTokens?: number
  /** Cancellation signal — aborts the underlying call (and its retries). */
  signal?: AbortSignal
}

/**
 * Run one structured-output model call through the gateway and return the
 * validated object. Thin wrapper so the judgment stages stay model-agnostic and
 * testable.
 *
 * Retries are pinned to 1 (down from the SDK default of 2): a public run fans
 * out up to ~16 calls, so default retries would let one flaky vendor amplify a
 * run to 48 attempts. One retry absorbs transient gateway hiccups; anything
 * worse should fail fast and surface (#241 cost guard).
 *
 * @throws if the model call fails after the retry (e.g. missing gateway
 *   credentials, an unknown model id, or repeated schema-validation failure),
 *   or if `signal` aborts.
 */
export async function generateStructured<T>({
  model,
  system,
  prompt,
  schema,
  maxOutputTokens,
  signal,
}: GenerateStructuredArgs<T>): Promise<T> {
  const { object } = await generateObject({
    model,
    system,
    prompt,
    schema,
    maxRetries: 1,
    ...(maxOutputTokens === undefined ? {} : { maxOutputTokens }),
    ...(signal === undefined ? {} : { abortSignal: signal }),
  })
  return object as T
}
