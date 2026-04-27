/**
 * @file Programmatic Open Graph image at the site root.
 * Next.js automatically serves this as the default `og:image` (and
 * Twitter card image) for any route that doesn't override it. Generated
 * via `next/og`'s {@link ImageResponse} so the image lives in code and
 * follows the brand palette without a separate static asset.
 */

import { ImageResponse } from 'next/og'

/** Open Graph image dimensions per the spec — 1200×630 renders cleanly across Twitter, LinkedIn, Slack, and Facebook. */
export const size = { width: 1200, height: 630 }

/** PNG output from `next/og` — declared so Next emits the right Content-Type. */
export const contentType = 'image/png'

/** Alt text surfaced to assistive tech and as the `twitter:image:alt` fallback. */
export const alt = 'Lucas Lawrence — Software Engineer at Snap'

/**
 * Court Vision palette. Mirrors the chart palette used elsewhere
 * (`components/training-facility/shared/charts`) so social previews
 * and the site itself feel like the same brand.
 */
const palette = {
  inkBlack: '#0a0a0a',
  rimOrange: '#fb923c',
  courtLineCream: '#f5f1e6',
  inkSoft: '#a3a3a3',
  hardwoodTan: '#c8a06a',
}

/**
 * Default OG image generator. Renders a court-themed 1200×630 social
 * card with name, role, and URL on a black background with a rim-orange
 * accent stripe. Edge runtime is used so the image is generated at the
 * CDN edge on first request and then cached.
 */
export default async function OpengraphImage(): Promise<ImageResponse> {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: palette.inkBlack,
          color: palette.courtLineCream,
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Rim-orange accent stripe down the left edge — court out-of-bounds line. */}
        <div
          style={{
            width: 24,
            height: '100%',
            backgroundColor: palette.rimOrange,
          }}
        />

        {/* Faint hardwood-tan court-line arc bottom-right — gives the card a half-court feel. */}
        <div
          style={{
            position: 'absolute',
            right: -180,
            bottom: -180,
            width: 520,
            height: 520,
            borderRadius: '50%',
            border: `4px solid ${palette.hardwoodTan}`,
            opacity: 0.35,
            display: 'flex',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '72px 80px',
            flex: 1,
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: palette.rimOrange,
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            Court Vision
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
              style={{
                fontSize: 96,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: '-0.02em',
                display: 'flex',
              }}
            >
              Lucas Lawrence
            </div>
            <div
              style={{
                fontSize: 40,
                color: palette.inkSoft,
                fontWeight: 500,
                lineHeight: 1.2,
                display: 'flex',
              }}
            >
              Software Engineer at Snap · Patent Holder
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 24,
              fontFamily: 'ui-monospace, monospace',
              color: palette.inkSoft,
              letterSpacing: '0.04em',
            }}
          >
            lucasklawrence.com
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
