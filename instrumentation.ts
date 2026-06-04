/**
 * Next.js instrumentation hooks (#220).
 *
 * `onRequestError` is Next's app-wide unhandled-error callback — it fires
 * for errors thrown during rendering, route handlers, server actions, and
 * middleware, including ones that never pass through `withTelemetry`
 * (e.g. a page render crash). Each firing emits an `unhandled_error`
 * event to the personal-telemetry pipeline for the App-health dashboard
 * (lucasklawrence/life#6).
 */

import type { Instrumentation } from 'next'

/**
 * Required instrumentation entry point. Telemetry needs no process-level
 * setup (the client lazy-initializes on first emit), so this is a no-op.
 */
export async function register(): Promise<void> {}

/**
 * Emit one `unhandled_error` telemetry event per server-side crash.
 *
 * PII guard: only the route *pattern* (`context.routePath`), HTTP method,
 * router kind/type, and the error's constructor name are emitted — never
 * the error message, stack, URL, or headers, all of which can carry user
 * input.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // The telemetry client is Node-only (@google-cloud/pubsub); skip the edge
  // runtime, where this hook can also fire.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Dynamic import keeps the Pub/Sub dependency out of the edge bundle and
  // defers credential-touching code until an error actually occurs.
  const { emitEvent, flush } = await import('@/lib/telemetry/client')
  emitEvent('unhandled_error', {
    status: 'error',
    attributes: {
      error_type: err instanceof Error ? err.constructor.name : typeof err,
      method: request.method,
      route: context.routePath,
      router_kind: context.routerKind,
      route_type: context.routeType,
    },
  })
  // Next awaits this hook's promise (waitUntil), so draining here keeps the
  // Vercel instance alive until the publish lands — errors are exactly the
  // events that must not be lost to an instance freeze.
  await flush()
}
