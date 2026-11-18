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

/**
 * GET a Gmail REST endpoint (path relative to `users/me/`) as JSON.
 *
 * @param {string} pathAndQuery e.g. `messages/abc?format=full`.
 * @param {string} token Access token from {@link gmailAccessToken}.
 * @throws {Error} on a non-2xx response.
 */
export async function gmailGet(pathAndQuery, token) {
  const res = await fetchWithTimeout(
    `https://gmail.googleapis.com/gmail/v1/users/me/${pathAndQuery}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  if (!res.ok) {
    throw new Error(`Gmail GET ${pathAndQuery} failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
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
