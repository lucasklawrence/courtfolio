/**
 * Shared helpers for the engine's progress-event emission (#241). Kept apart
 * from the stages so `run-panel.ts` and `verify.ts` can both emit without
 * importing each other, and so the "never let a listener break the run" rule
 * lives in exactly one place.
 */
import type { PanelEvent, PanelRunOptions } from './types'

/**
 * Emit a progress event to the run's listener, if any. Listener exceptions are
 * swallowed: observation must never be able to fail the run it observes.
 */
export function emitPanelEvent(opts: PanelRunOptions | undefined, event: PanelEvent): void {
  try {
    opts?.onEvent?.(event)
  } catch {
    // A broken listener is the listener's problem — the run continues.
  }
}

/**
 * The error's constructor/DOMException name, for events and telemetry. Never
 * the message — error messages can embed prompts or payloads (PII rule, same
 * convention as {@link withTelemetry}).
 */
export function errorTypeOf(err: unknown): string {
  if (err instanceof Error) return err.name || err.constructor.name
  return typeof err
}

/**
 * Whether an error is a cancellation rather than a model failure. Cancellation
 * must propagate (an aborted run is not a degraded run): `AbortSignal.timeout`
 * aborts with a `TimeoutError` DOMException, manual aborts with `AbortError`.
 */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')
}
