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
 * Global metadata configuration for the site.
 * This metadata is used for SEO and browser tab titles.
 */
export const metadata: Metadata = {
  title: 'Lucas Lawrence | Court Site',
  description: 'Digital home court of Lucas Lawrence',
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
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
