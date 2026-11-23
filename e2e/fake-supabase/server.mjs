/**
 * In-memory stand-in for Supabase's PostgREST API, for the admin e2e specs (#481).
 *
 * The admin pages read through the Supabase clients and write through the real
 * `/api/admin/*` routes, which use the service role. CI has no Supabase
 * credentials, and a local run must never write production. So the
 * `e2e:dev:admin` server points every client at this process instead. Its data
 * is synthetic (`seed.json`) and lives only in memory.
 *
 * Supported, because the Weight Room's queries use it:
 * - `GET /rest/v1/<table>`: `select` (a column list or `*`), multi-column
 *   `order` (`col.asc|desc[.nullsfirst|.nullslast]`), `limit` / `offset`, and
 *   the filters `eq`, `neq`, `is`, `in`, `gt`, `gte`, `lt`, `lte`.
 * - `POST` (insert one row or an array), `PATCH` and `DELETE`, each with the
 *   same filters, honouring `Prefer: return=representation`.
 * - `Accept: application/vnd.pgrst.object+json` (supabase-js `.single()`),
 *   answering 406 / `PGRST116` unless exactly one row matches.
 * - CORS, so the browser client can reach it from the app's origin.
 *
 * Anything else answers **501 with the request in the body** and logs it, so
 * a query this fake doesn't understand fails a test loudly rather than
 * returning plausible-looking emptiness.
 *
 * Test hooks: `POST /__reset` restores the seed, `GET /__state` returns every
 * table, `GET /__health` answers 200 for Playwright's readiness probe.
 *
 * Usage: node e2e/fake-supabase/server.mjs   (port from FAKE_SUPABASE_PORT,
 * default 54329; binds 127.0.0.1 only)
 */

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** Port the fake listens on. Matches `NEXT_PUBLIC_SUPABASE_URL` in `e2e:dev:admin`. */
export const FAKE_SUPABASE_PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54329)

const SEED_PATH = join(dirname(fileURLToPath(import.meta.url)), 'seed.json')

/** Query-string keys that are not column filters. */
const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

/** Error raised for a request shape this fake doesn't implement. */
class Unsupported extends Error {}

/**
 * Load the synthetic seed: `{ tables: { <name>: Row[] } }`.
 *
 * @returns {Record<string, Array<Record<string, unknown>>>}
 */
export function loadSeed() {
  const seed = JSON.parse(readFileSync(SEED_PATH, 'utf8'))
  return structuredClone(seed.tables)
}

/**
 * Turn a PostgREST literal into the JS value a row would hold.
 *
 * @param {string} raw
 */
function literal(raw) {
  if (raw === 'null') return null
  if (raw === 'true') return true
  if (raw === 'false') return false
  return raw
}

/** Compare a stored value with a filter literal, numbers numerically. */
function compare(a, b) {
  if (a === null || a === undefined) return b === null ? 0 : -1
  if (typeof a === 'number') return a - Number(b)
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
}

/**
 * Build a row predicate from the query's filter params.
 *
 * @param {URLSearchParams} params
 * @returns {(row: Record<string, unknown>) => boolean}
 * @throws {Unsupported} on an operator outside the supported set.
 */
export function buildFilter(params) {
  const tests = []
  for (const [column, expr] of params) {
    if (RESERVED_PARAMS.has(column)) continue
    const dot = expr.indexOf('.')
    const op = expr.slice(0, dot)
    const value = expr.slice(dot + 1)
    switch (op) {
      case 'eq':
        tests.push(row => row[column] !== null && compare(row[column], literal(value)) === 0)
        break
      case 'neq':
        tests.push(row => row[column] === null || compare(row[column], literal(value)) !== 0)
        break
      case 'is':
        tests.push(row => (row[column] ?? null) === literal(value))
        break
      case 'in': {
        const list = value.replace(/^\(|\)$/g, '').split(',').map(v => v.replace(/^"|"$/g, ''))
        tests.push(row => row[column] !== null && list.some(v => compare(row[column], v) === 0))
        break
      }
      case 'gt':
        tests.push(row => row[column] !== null && compare(row[column], value) > 0)
        break
      case 'gte':
        tests.push(row => row[column] !== null && compare(row[column], value) >= 0)
        break
      case 'lt':
        tests.push(row => row[column] !== null && compare(row[column], value) < 0)
        break
      case 'lte':
        tests.push(row => row[column] !== null && compare(row[column], value) <= 0)
        break
      default:
        throw new Unsupported(`filter operator '${op}' on '${column}'`)
    }
  }
  return row => tests.every(t => t(row))
}

/**
 * Sort rows by a PostgREST `order` value, e.g. `exercise.asc.nullsfirst,id.desc`.
 * Postgres puts nulls last ascending and first descending unless told otherwise.
 *
 * @param {Array<Record<string, unknown>>} rows
 * @param {string | null} order
 */
export function sortRows(rows, order) {
  if (!order) return rows
  const keys = order.split(',').map(part => {
    const [column, ...mods] = part.split('.')
    const desc = mods.includes('desc')
    const nullsFirst = mods.includes('nullsfirst') || (desc && !mods.includes('nullslast'))
    return { column, desc, nullsFirst }
  })
  return [...rows].sort((a, b) => {
    for (const { column, desc, nullsFirst } of keys) {
      const av = a[column] ?? null
      const bv = b[column] ?? null
      if (av === null && bv === null) continue
      if (av === null) return nullsFirst ? -1 : 1
      if (bv === null) return nullsFirst ? 1 : -1
      const c = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
      if (c !== 0) return desc ? -c : c
    }
    return 0
  })
}

/**
 * Project rows onto a `select` list. Embedded resources (`a(b)`) and renames
 * (`alias:col`) aren't supported, and say so.
 *
 * @param {Array<Record<string, unknown>>} rows
 * @param {string | null} select
 */
export function projectRows(rows, select) {
  if (!select || select === '*') return rows
  const columns = select.split(',').map(c => c.trim())
  for (const c of columns) {
    if (c === '*') return rows
    if (/[():]/.test(c)) throw new Unsupported(`select item '${c}'`)
  }
  return rows.map(row => Object.fromEntries(columns.map(c => [c, row[c] ?? null])))
}

/**
 * Fill the defaults the real tables would: a uuid `id`, timestamps, and null
 * for every column the table's seed rows carry but the insert omitted.
 *
 * @param {Record<string, unknown>} row The row as sent.
 * @param {string[]} columns The table's declared columns, from the seed file.
 */
function withDefaults(row, columns) {
  const now = new Date().toISOString()
  const out = {}
  for (const c of columns) out[c] = null
  if (columns.includes('id')) out.id = randomUUID()
  if (columns.includes('created_at')) out.created_at = now
  if (columns.includes('updated_at')) out.updated_at = now
  return { ...out, ...row }
}

/**
 * Create the fake. Returned separately from `listen` so a unit test can drive
 * it on an ephemeral port.
 */
export function createFakeSupabase() {
  const seedFile = JSON.parse(readFileSync(SEED_PATH, 'utf8'))
  /** table → declared column list */
  const columnsOf = seedFile.columns
  let tables = loadSeed()

  /** @type {import('node:http').RequestListener} */
  async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://fake')
    const origin = req.headers.origin ?? '*'
    const cors = {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS,HEAD',
      // `*` doesn't cover Authorization, so echo exactly what was asked for.
      'access-control-allow-headers':
        req.headers['access-control-request-headers'] ?? 'authorization,apikey,content-type',
      'access-control-expose-headers': 'content-range',
    }
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json', ...cors })
      res.end(body === undefined ? '' : JSON.stringify(body))
    }

    if (req.method === 'OPTIONS') return send(204)

    let raw = ''
    for await (const chunk of req) raw += chunk

    try {
      if (url.pathname === '/__health') return send(200, { ok: true })
      if (url.pathname === '/__reset' && req.method === 'POST') {
        tables = loadSeed()
        return send(200, { ok: true })
      }
      if (url.pathname === '/__state') return send(200, tables)

      // No session ever exists here; the stub supplies the admin identity.
      if (url.pathname.startsWith('/auth/v1/')) {
        return send(401, { code: 401, msg: 'No session in the e2e fake' })
      }

      const match = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)
      if (!match) throw new Unsupported(`path ${url.pathname}`)
      const table = match[1]
      if (!(table in tables)) {
        return send(404, {
          code: 'PGRST205',
          message: `Could not find the table 'public.${table}' in the e2e fake`,
          details: null,
          hint: 'Add it to e2e/fake-supabase/seed.json',
        })
      }

      const params = url.searchParams
      const filter = buildFilter(params)
      const prefer = String(req.headers.prefer ?? '')
      const wantsObject = String(req.headers.accept ?? '').includes('vnd.pgrst.object+json')
      const representation = prefer.includes('return=representation')

      /** Answer with rows, as a single object when `.single()` asked for one. */
      const reply = (status, rows, { always = true } = {}) => {
        const projected = projectRows(rows, params.get('select'))
        if (wantsObject) {
          if (projected.length !== 1) {
            return send(406, {
              code: 'PGRST116',
              message: 'JSON object requested, multiple (or no) rows returned',
              details: `The result contains ${projected.length} rows`,
              hint: null,
            })
          }
          return send(status, projected[0])
        }
        if (!always) return send(status === 200 ? 204 : status)
        return send(status, projected)
      }

      if (req.method === 'GET' || req.method === 'HEAD') {
        let rows = sortRows(tables[table].filter(filter), params.get('order'))
        const offset = Number(params.get('offset') ?? 0)
        const limit = params.has('limit') ? Number(params.get('limit')) : undefined
        rows = rows.slice(offset, limit === undefined ? undefined : offset + limit)
        return reply(200, rows)
      }

      if (req.method === 'POST') {
        if (prefer.includes('resolution=')) throw new Unsupported('upsert')
        const body = JSON.parse(raw || '[]')
        const inserted = (Array.isArray(body) ? body : [body]).map(r =>
          withDefaults(r, columnsOf[table])
        )
        tables[table].push(...inserted)
        return reply(201, inserted, { always: representation })
      }

      if (req.method === 'PATCH') {
        const changes = JSON.parse(raw || '{}')
        const updated = []
        tables[table] = tables[table].map(row => {
          if (!filter(row)) return row
          const next = { ...row, ...changes }
          updated.push(next)
          return next
        })
        return reply(200, updated, { always: representation })
      }

      if (req.method === 'DELETE') {
        const removed = tables[table].filter(filter)
        tables[table] = tables[table].filter(row => !filter(row))
        return reply(200, removed, { always: representation })
      }

      throw new Unsupported(`method ${req.method}`)
    } catch (err) {
      if (err instanceof Unsupported) {
        const detail = { method: req.method, url: req.url, body: raw || undefined }
        console.error(`[fake-supabase] unsupported ${err.message}`, detail)
        return send(501, {
          code: 'E2E_FAKE_UNSUPPORTED',
          message: `The e2e Supabase fake does not support ${err.message}`,
          details: detail,
          hint: 'Extend e2e/fake-supabase/server.mjs',
        })
      }
      console.error('[fake-supabase] error', err)
      return send(500, { code: 'E2E_FAKE_ERROR', message: String(err), details: null, hint: null })
    }
  }

  return createServer((req, res) => void handle(req, res))
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createFakeSupabase().listen(FAKE_SUPABASE_PORT, '127.0.0.1', () => {
    console.log(`[fake-supabase] listening on http://127.0.0.1:${FAKE_SUPABASE_PORT}`)
  })
}
