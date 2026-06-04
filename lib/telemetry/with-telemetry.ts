/**
 * Per-request telemetry wrapper for App Router route handlers (#220).
 *
 * Wraps a handler so every invocation emits exactly one `event` row to the
 * personal-telemetry pipeline with the route name, outcome status, and
 * duration — the "runtime health" layer of the App-health dashboard
 * (lucasklawrence/life#6). `@vercel/analytics` already covers client RUM;
 * this covers the server side Vercel can't see.
 *
 * Telemetry is best-effort by construction ({@link emitEvent} never throws),
 * so wrapping cannot change a handler's behavior: responses pass through
 * untouched and thrown errors re-throw after an `error`-status emission.
 */

import 'server-only'

import { after } from 'next/server'

import { emitEvent, flush } from '@/lib/telemetry/client'

/**
 * Schedule a telemetry {@link flush} for after the response is sent.
 *
 * Emission is fire-and-forget, but on Vercel the function instance can be
 * frozen as soon as the response goes out — an in-flight Pub/Sub publish
 * would silently never complete. `after()` runs inside the platform's
 * `waitUntil` scope, which keeps the instance alive until the queued
 * publishes drain, without adding latency to the response itself.
 *
 * Safe to call from any server context: outside a request scope (unit
 * tests, scripts) `after()` throws, which is caught here — the client's
 * `beforeExit` hook still drains queued publishes on natural process exit.
 */
export function scheduleFlush(): void {
  try {
    after(flush)
  } catch {
    // Not in a request scope — rely on the client's exit-flush hook.
  }
}

/**
 * Wrap a route handler with one-event-per-request telemetry.
 *
 * Emits `name` with `status: 'ok'` for responses below 400, `'error'`
 * otherwise, plus `duration_ms` and the numeric `http_status` in attributes.
 * A thrown error emits `status: 'error'` with the error's constructor name
 * (never the message — messages can carry user input) and re-throws so
 * Next.js error handling proceeds unchanged.
 *
 * @param name Stable, low-cardinality route label, e.g.
 *   `'POST /api/admin/weight-room/sets'`. Use the route *pattern*, never a
 *   concrete URL — concrete URLs explode cardinality and can carry PII.
 * @param handler The original route handler. Any signature is accepted so
 *   dynamic-segment handlers (`(req, ctx)`) wrap the same as parameterless
 *   ones.
 */
export function withTelemetry<Args extends unknown[], Res extends Response>(
  name: string,
  handler: (...args: Args) => Promise<Res>
): (...args: Args) => Promise<Res> {
  return async (...args: Args): Promise<Res> => {
    const startedAt = performance.now()
    try {
      const response = await handler(...args)
      emitEvent(name, {
        status: response.status < 400 ? 'ok' : 'error',
        durationMs: Math.round(performance.now() - startedAt),
        attributes: { http_status: response.status },
      })
      return response
    } catch (err) {
      emitEvent(name, {
        status: 'error',
        durationMs: Math.round(performance.now() - startedAt),
        attributes: {
          // Constructor name only — error *messages* can embed request
          // payloads or emails, which must never reach telemetry (PII rule).
          error_type: err instanceof Error ? err.constructor.name : typeof err,
        },
      })
      throw err
    } finally {
      // Drain this request's publishes (including any domain metrics the
      // handler emitted) once the response is out — see scheduleFlush.
      scheduleFlush()
    }
  }
}
