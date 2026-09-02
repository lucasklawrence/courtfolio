/**
 * Shared PostgREST pagination for the Supabase read layer.
 *
 * Lives in its own module rather than inside one domain's assembler because
 * every growing table hits the same cap: cardio's trend tables did first
 * (`lib/data/cardio-shared.ts`), and `weight_room_sets` crossed it in July 2026
 * (`lib/data/weight-room-shared.ts`, #336). Both read paths now share this
 * implementation so a fix or a page-size change lands in one place.
 */

/**
 * PostgREST caps every response at a fixed row count (1000 on Supabase's
 * hosted default). {@link fetchAllRows} pages around that cap.
 */
export const SUPABASE_PAGE_SIZE = 1000

/**
 * Minimal structural view of the slice of a Supabase query builder that
 * {@link fetchAllRows} drives: a `.range()` that yields an awaitable page
 * result. Typed structurally so the helper stays decoupled from
 * `@supabase/supabase-js` generics (the clients are already typed loosely as
 * `SupabaseClient` for the same reason).
 */
export type PagedQuery = {
  range: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
}

/**
 * Fetch **every** row a query would return, defeating PostgREST's
 * per-response row cap ({@link SUPABASE_PAGE_SIZE}).
 *
 * A bare `.select().order('date', { ascending: true })` silently returns
 * only the first page — and because the sort is ascending, that page is
 * the *oldest* rows. Any table past the cap therefore loses its most
 * recent data entirely: a 1171-row trend renders nothing newer than its
 * 1000th-oldest date, so a current-month view reads "no data in range"
 * even though the rows exist. This pages through with `.range()` until a
 * short page proves the tail was reached.
 *
 * The short-page termination assumes the server's `max-rows` is not *below*
 * {@link SUPABASE_PAGE_SIZE}, which holds because the constant tracks
 * Supabase's own default cap — a full page is the only ambiguous response.
 *
 * Paging is only stable when the query's ordering is total: an ambiguous sort
 * can repeat or skip rows across page boundaries. Callers that sort on a
 * non-unique column must chain tie-breakers (the weight-room sets read chains
 * `logged_at`, `updated_at`, `id` for exactly this reason, #229).
 *
 * @param makeQuery Builds a *fresh* query on each call. A PostgREST
 *   builder can only be awaited once, so every page needs its own; the
 *   builder must already carry its `.select()`/`.order()` — this helper
 *   only appends `.range()`.
 * @param label Table name, used only in the thrown error message.
 * @throws when any page errors (propagates the PostgREST message so the
 *   existing per-table error assertions keep matching).
 */
export async function fetchAllRows(
  makeQuery: () => PagedQuery,
  label: string
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = []
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await makeQuery().range(from, from + SUPABASE_PAGE_SIZE - 1)
    if (error) {
      throw new Error(`Failed to load ${label}: ${error.message}`)
    }
    const page = (data ?? []) as Array<Record<string, unknown>>
    rows.push(...page)
    if (page.length < SUPABASE_PAGE_SIZE) break
  }
  return rows
}
