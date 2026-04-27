/**
 * @file RootLayout.tsx
 * @description Defines the global HTML layout for the Next.js application, including
 * font configuration, global styles, metadata, and favicon setup.
 */

import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import { JSX } from 'react'

// Load Geist Sans font with a CSS variable
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

// Load Geist Mono font with a CSS variable
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

/**
 * Canonical site origin. Used by Next.js to resolve relative URLs in
 * `openGraph.images`, `twitter.images`, and `alternates.canonical` so that
 * crawlers, social cards, and JSON-LD all see absolute URLs.
 */
const SITE_URL = 'https://lucasklawrence.com'

/**
 * Site-wide description used as the default meta description and the
 * Open Graph / Twitter description on routes that don't override it.
 * Kept under ~160 chars for snippet compatibility.
 */
const SITE_DESCRIPTION =
  'Software engineer at Snap building interactive, basketball-themed product experiences with Next.js, React, TypeScript, and Java. Patent holder.'

/**
 * Site-wide root title used when a route does not export its own title.
 * Routes that set `title` participate in the `title.template` below and
 * render as `<route> | Lucas Lawrence`.
 */
const SITE_TITLE = 'Lucas Lawrence — Software Engineer at Snap & Patent Holder'

/**
 * JSON-LD Person schema describing Lucas Lawrence for search engines.
 * Inlined as `<script type="application/ld+json">` in the document head.
 * Lives at the site root so the Person entity is associated with the
 * domain itself rather than a single inner route.
 */
const PERSON_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Lucas Lawrence',
  jobTitle: 'Software Engineer',
  url: SITE_URL,
  worksFor: { '@type': 'Organization', name: 'Snap Inc.' },
  email: 'mailto:lucasklawrence@gmail.com',
  sameAs: ['https://github.com/lucasklawrence', 'https://linkedin.com/in/lucasklawrence'],
}

/**
 * Global metadata configuration for the site. Per-route layouts may
 * override `title` (which then participates in the template below),
 * `description`, `openGraph`, and `alternates.canonical`.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s | Lucas Lawrence',
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Lucas Lawrence',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
}

/**
 * Root layout component that wraps the entire application.
 * It defines global HTML structure, font variables, favicon links,
 * and includes Vercel analytics.
 *
 * @param {Object} props - React component props
 * @param {React.ReactNode} props.children - The nested page content
 * @returns {JSX.Element} The rendered HTML layout
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): JSX.Element {
  return (
    <html lang="en">
      <head>
        {/* Modern browsers (SVG) */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />

        {/* Fallback for Safari & older browsers */}
        <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />

        {/* Optional: theme color for mobile browsers */}
        <meta name="theme-color" content="#000000" />

        {/*
         * JSON-LD Person schema. Helps Google associate the site with
         * Lucas Lawrence as an entity (knowledge panel, sameAs links).
         * Inlined rather than emitted via next/script so the bytes are
         * present in the static HTML and readable by non-JS crawlers.
         */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(PERSON_JSON_LD) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased touch-pan-x touch-pan-y`}
      >
        {/*
         * Skip-to-content link — first focusable element in the document.
         * Visually hidden by default; becomes visible when a keyboard user
         * Tabs into it. Targets the <main id="main"> landmark below so
         * screen-reader and keyboard users can bypass any future header
         * chrome and jump straight to page content.
         */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[1000] focus:rounded focus:bg-black focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          Skip to main content
        </a>
        {/*
         * tabindex="-1" makes <main> a programmatic focus target so the
         * skip link reliably moves focus into the landmark across
         * browsers (Safari in particular won't shift focus to a non-
         * focusable fragment target on its own).
         */}
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Analytics />
      </body>
    </html>
  )
}
