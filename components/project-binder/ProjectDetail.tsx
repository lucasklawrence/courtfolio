'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { CARD_MORPH_SPRING, cardLayoutId } from './cardMorph'
import type { TradeCardProps } from './TradeCard'

/** Props for the {@link ProjectDetail} overlay. */
type ProjectDetailProps = {
  /** The project to show, expanded. Shares its `slug` with the originating card. */
  project: TradeCardProps
  /** Called when the user dismisses the overlay (backdrop click, ✕, or Escape). */
  onClose: () => void
}

/**
 * Full-screen, dimmed overlay that presents a single project at a larger scale.
 *
 * Mounted by {@link ProjectGallery} inside an `AnimatePresence` while a card is
 * selected. The panel carries the same `layoutId` as its originating
 * {@link TradeCard} ({@link cardLayoutId}), so Framer Motion morphs the card
 * open into this panel and back on close. Under `prefers-reduced-motion` the
 * `layoutId` is dropped, so there is no layout morph — the overlay simply fades
 * (the backdrop's opacity transition, inherited by the panel).
 *
 * While open it locks body scroll, closes on Escape, and moves focus to the
 * close button.
 */
export const ProjectDetail = ({ project, onClose }: ProjectDetailProps) => {
  const reduce = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)

  // Escape-to-close + body scroll lock + initial focus for the lifetime of the
  // overlay. Restores the previous body overflow on unmount.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const { name, slug, tagline, thumbnailUrl, stack, impact, year, moment, href } = project

  return (
    // Backdrop doubles as the AnimatePresence child: its opacity exit animation
    // keeps the panel mounted long enough to morph back to the card. Clicking it
    // closes; the panel stops propagation so inner clicks don't dismiss.
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        layoutId={reduce ? undefined : cardLayoutId(slug)}
        transition={{ layout: CARD_MORPH_SPRING }}
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${name} details`}
        data-testid="project-detail"
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-yellow-400 bg-neutral-900 text-white p-6 shadow-2xl"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close project details"
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-lg leading-none text-neutral-300 hover:bg-black/60 hover:text-white transition"
        >
          ✕
        </button>

        <div className="w-full aspect-video relative rounded-md overflow-hidden border border-neutral-600 bg-black">
          <Image
            src={thumbnailUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 512px"
          />
        </div>

        <h2 className="mt-5 text-2xl font-bold leading-tight">{name}</h2>
        <p className="mt-1 text-sm text-neutral-400 italic">{tagline}</p>

        <p className="mt-4 text-sm text-yellow-200">{impact}</p>
        <p className="mt-2 text-xs text-yellow-200/90">
          📅 {year} · ⚙️ {stack.join(', ')}
        </p>
        <p className="mt-3 text-sm text-yellow-100">{moment}</p>

        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-yellow-300 transition"
          >
            View Project →
          </a>
        )}
      </motion.div>
    </motion.div>
  )
}
