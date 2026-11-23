/**
 * Minimal Gmail REST client for the email importers (OTbeat, events): a
 * refresh-token OAuth exchange and a few GETs over native `fetch`,
 * with no Google SDK dependency.
 *
 * Loaded as ESM from `.mjs` callers — no TypeScript transpile step.
 *
 * Required env (CI: GitHub secrets → job env; local: `.env.local`):
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN — a token
 *   authorizing `gmail.readonly`; setup is in scripts/README.md.
 */

/** Per-request timeout for Gmail HTTP calls, so a stalled request can't run out the CI job clock. */
const HTTP_TIMEOUT_MS = 30_000

/**
 * Read a required env var or throw a clear, actionable error.
 *
 * @param {string} name
 * @returns {string}
 * @throws {Error} when the variable is unset or blank.
 */
export function requireEnv(name) {
  const v = process.env[name]?.trim()
  if (!v) {
    throw new Error(
      `${name} is not set. In CI add it as a GitHub secret; locally add it to .env.local.`
    )
  }
  return v
}

/** `fetch` with an {@link HTTP_TIMEOUT_MS} abort, so a hung token/API call fails fast instead of hanging. */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Exchange the long-lived Gmail refresh token for a short-lived access token.
 *
 * @returns {Promise<string>} OAuth2 access token.
 * @throws {Error} when the exchange fails or returns no token.
 */
export async function gmailAccessToken() {
  const res = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireEnv('GMAIL_CLIENT_ID'),
      client_secret: requireEnv('GMAIL_CLIENT_SECRET'),
      refresh_token: requireEnv('GMAIL_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    throw new Error(`Gmail token refresh failed: ${res.status} ${await res.text()}`)
  }
  const json = await res.json()
  if (!json.access_token) throw new Error('Gmail token refresh returned no access_token')
  return json.access_token
}

/** Attempts per GET when Gmail answers with a rate limit or a server error. */
const GET_ATTEMPTS = 5

/**
 * Whether a failed response is worth retrying: a rate limit (429, or the 403
 * Gmail uses for `rateLimitExceeded` / `userRateLimitExceeded`) or a 5xx.
 */
function isTransient(status, body) {
  return status === 429 || status >= 500 || (status === 403 && /rateLimitExceeded/i.test(body))
}

/**
 * GET a Gmail REST endpoint (path relative to `users/me/`) as JSON.
 *
 * Rate limits and server errors are retried with exponential backoff
 * (honouring `Retry-After`), up to {@link GET_ATTEMPTS} attempts, so a burst
 * of concurrent fetches slows down instead of failing the run.
 *
 * @param {string} pathAndQuery e.g. `messages/abc?format=full`.
 * @param {string} token Access token from {@link gmailAccessToken}.
 * @param {{ baseDelayMs?: number }} [opts] First backoff delay (default 1s).
 * @throws {Error & { status: number }} on a non-2xx response that is not
 *   transient, or still failing after the last attempt. `status` is the HTTP
 *   status, so a caller can treat a 404 (message deleted) differently.
 */
export async function gmailGet(pathAndQuery, token, { baseDelayMs = 1000 } = {}) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetchWithTimeout(
      `https://gmail.googleapis.com/gmail/v1/users/me/${pathAndQuery}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    if (res.ok) return res.json()
    const body = await res.text()
    if (attempt < GET_ATTEMPTS && isTransient(res.status, body)) {
      const retryAfter = Number(res.headers.get('retry-after'))
      // Retry-After is honoured up to a minute, so one odd header can't stall the job.
      const delay =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter, 60) * 1000
          : baseDelayMs * 2 ** (attempt - 1)
      await new Promise(r => setTimeout(r, delay))
      continue
    }
    throw Object.assign(new Error(`Gmail GET ${pathAndQuery} failed: ${res.status} ${body}`), {
      status: res.status,
    })
  }
}

/**
 * A Gmail client whose access token is renewed when it expires mid-run.
 * @typedef {Object} GmailSession
 * @property {string} token The current access token.
 * @property {(pathAndQuery: string, opts?: { baseDelayMs?: number }) => Promise<any>} get
 *   {@link gmailGet} with the current token; a 401 renews the token once and
 *   retries the call once.
 */

/**
 * Wrap an access token so a long run outlives it. Access tokens last about an
 * hour, so a local backfill fetching thousands of messages would otherwise
 * fail partway with 401. Concurrent calls that hit the expiry together share
 * one renewal.
 *
 * @param {string} initialToken From {@link gmailAccessToken}.
 * @param {() => Promise<string>} [refresh] Fetches a new token (default
 *   {@link gmailAccessToken}).
 * @returns {GmailSession}
 */
export function gmailSession(initialToken, refresh = gmailAccessToken) {
  let token = initialToken
  let pending = null
  const renew = stale => {
    if (token !== stale) return Promise.resolve(token) // another call already renewed it
    pending ??= refresh()
      .then(t => {
        token = t
        return t
      })
      .finally(() => {
        pending = null
      })
    return pending
  }
  return {
    get token() {
      return token
    },
    async get(pathAndQuery, opts) {
      const used = token
      try {
        return await gmailGet(pathAndQuery, used, opts)
      } catch (err) {
        if (err?.status !== 401) throw err
        return gmailGet(pathAndQuery, await renew(used), opts)
      }
    },
  }
}

/** Decode a Gmail base64url message-part body to a UTF-8 string. */
export function decodeBase64Url(data) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

/**
 * Depth-first search a Gmail payload tree for the first `text/html` part.
 *
 * @returns {string|null} The decoded HTML, or null when the message has none.
 */
export function findHtmlPart(payload) {
  if (payload?.mimeType === 'text/html' && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  for (const part of payload?.parts ?? []) {
    const found = findHtmlPart(part)
    if (found) return found
  }
  return null
}

/**
 * Every message id matching a Gmail search query (paginated).
 *
 * @param {string} token Access token.
 * @param {string} query Gmail search syntax, e.g. `from:a@b.com newer_than:8d`.
 * @returns {Promise<string[]>}
 */
export async function listMessageIds(token, query) {
  const q = encodeURIComponent(query)
  const ids = []
  let pageToken = ''
  do {
    const page = await gmailGet(
      `messages?q=${q}&maxResults=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
      token
    )
    for (const m of page.messages ?? []) ids.push(m.id)
    pageToken = page.nextPageToken ?? ''
  } while (pageToken)
  return ids
}

/**
 * `Promise.all(items.map(fn))` with at most `limit` calls in flight, results
 * in input order — for fetching many messages without one-at-a-time latency
 * or an unbounded burst against the API quota. The first rejection rejects
 * the whole call.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} limit Calls in flight at once (at least 1).
 * @param {(item: T) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  const workers = Math.min(Math.max(1, limit), items.length)
  await Promise.all(Array.from({ length: workers }, worker))
  return results
}

/**
 * A header's value from a Gmail payload, case-insensitively, or ''.
 *
 * @param {object} payload `message.payload` from a `format=full` GET.
 * @param {string} name e.g. `Subject`.
 */
export function headerValue(payload, name) {
  const lower = name.toLowerCase()
  return payload?.headers?.find(h => h.name?.toLowerCase() === lower)?.value ?? ''
}

/**
 * Resolve a lookback window in days from an env var, defaulting to `fallback`.
 * Rejects non-positive / non-integer values rather than letting `Number()`
 * coerce them into a `newer_than:NaNd` / `newer_than:0d` query that silently
 * returns the wrong window.
 *
 * @param {string} envName e.g. `OTBEAT_LOOKBACK_DAYS`.
 * @param {number} fallback Days when the variable is unset.
 * @returns {number}
 * @throws {Error} on a value that isn't a positive integer.
 */
export function resolveLookbackDays(envName, fallback) {
  const raw = process.env[envName]
  if (raw == null || raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${envName} must be a positive integer (days); got ${JSON.stringify(raw)}`)
  }
  return n
}
