import type { NextRequest } from 'next/server'

/**
 * Shared secret-header auth for server-to-server endpoints (device
 * automations, background skills) that authenticate with an API key
 * rather than a user session. Used by both `/api/health/auto-sync` and
 * `/api/admin/cardio/trends`.
 *
 * Fails **closed**: returns `false` (never throws) when the expected-key
 * env var is unset, so a misconfigured deploy disables the endpoint
 * instead of accepting any request. The misconfiguration is logged so
 * it's visible in server logs.
 *
 * @param request Incoming request; the caller's key is read from `headerName`.
 * @param headerName Request header carrying the caller's key (e.g.
 *   `X-Health-Sync-Key`).
 * @param envVarName Name of the env var holding the expected key (e.g.
 *   `HEALTH_AUTO_SYNC_API_KEY`); used for both the lookup and the
 *   misconfiguration log line.
 */
export function validateApiKey(
  request: NextRequest,
  headerName: string,
  envVarName: string,
): boolean {
  const key = request.headers.get(headerName)
  const expectedKey = process.env[envVarName]
  if (!expectedKey) {
    console.error(`${envVarName} env var not set — endpoint is disabled`)
    return false
  }
  return key === expectedKey
}
