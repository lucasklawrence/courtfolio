/**
 * Resume download endpoint (#220).
 *
 * The resume itself stays a static asset (`/LucasLawrenceResume.pdf`);
 * this route exists so the server can *see* the download. A static-file
 * click never reaches application code, so the previous direct links were
 * invisible to the telemetry pipeline — pointing them here emits a
 * `resume_download` business event, then redirects to the PDF.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { emitEvent } from '@/lib/telemetry/client'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

/**
 * Emit `resume_download` and 307-redirect to the static PDF.
 *
 * @param request Incoming GET. Only the URL is used (for the redirect base).
 * @returns 307 redirect to `/LucasLawrenceResume.pdf` — temporary, so
 *   browsers re-request through this route (and re-count) instead of
 *   caching a permanent mapping.
 */
async function handleGET(request: NextRequest): Promise<NextResponse> {
  // Domain event, distinct from the per-request health event the wrapper
  // emits: dashboards chart `resume_download` without parsing route names.
  emitEvent('resume_download')
  return NextResponse.redirect(new URL('/LucasLawrenceResume.pdf', request.url), {
    status: 307,
  })
}

/** `handleGET` wrapped with one-event-per-request telemetry (#220). */
export const GET = withTelemetry('GET /resume', handleGET)
