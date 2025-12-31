/**
 * Detect Safari/WebKit (including iOS webviews like Chrome on iOS).
 * We want to treat iOS WebKit the same as Safari for foreignObject quirks.
 */
export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''

  const isIOSWebKit = /iP(ad|hone|od)/i.test(ua) && /WebKit/i.test(ua)
  const isDesktopSafari =
    /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|OPR|Opera|OPiOS/i.test(ua)

  return isIOSWebKit || isDesktopSafari
}
