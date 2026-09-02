/**
 * Helpers for reading several datasets concurrently in a Server Component when
 * a failure should degrade the view rather than replace the route (#345).
 *
 * The obvious shape — a `let loadError` reassigned from each `.catch()` — is
 * flagged by `react-hooks/immutability`, which can't tell an async Server
 * Component from a client render. `Promise.allSettled` plus these two readers
 * expresses the same thing without mutation, and makes the fallback for each
 * dataset explicit at the call site.
 */

/**
 * The first rejection message across `results`, or `undefined` when all
 * settled successfully.
 *
 * "First" is argument order, not completion order, so the message a page shows
 * is stable across runs — otherwise two simultaneous failures would surface
 * whichever lost the race.
 *
 * @param results Settled results, in the order their datasets are listed.
 */
export function firstRejectionMessage(
  ...results: readonly PromiseSettledResult<unknown>[]
): string | undefined {
  for (const result of results) {
    if (result.status === 'rejected') {
      const { reason } = result
      return reason instanceof Error ? reason.message : String(reason)
    }
  }
  return undefined
}

/**
 * The settled value, or `fallback` when the read rejected.
 *
 * Pair with {@link firstRejectionMessage}: this decides what the view renders,
 * that decides whether it shows an error alongside it. The fallback is passed
 * per call because it differs by dataset — `null` where the reader's own empty
 * contract is `null`, `[]` where it returns a list.
 */
export function settledOr<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback
}
