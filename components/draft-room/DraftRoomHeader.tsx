import type { ReactNode } from 'react'

import type { Thesis } from '@/lib/panel/types'

/** Props for {@link DraftRoomHeader}. */
interface DraftRoomHeaderProps {
  /** The thesis under test, rendered as the numbered claim list. */
  thesis: Thesis
  /** Whether the data on the page is hand-authored illustrative data (drives the badge). */
  illustrative: boolean
  /** Optional slot rendered after the badge — the live mode's run controls. */
  children?: ReactNode
}

/**
 * The Draft Room's shared header: eyebrow, title, intro copy, the thesis
 * card, and the illustrative-data badge. Extracted from {@link DraftRoom} so
 * the live island (#241) reuses the exact same header instead of duplicating
 * it — the replay page's rendering is unchanged.
 */
export function DraftRoomHeader({ thesis, illustrative, children }: DraftRoomHeaderProps) {
  return (
    <header className="flex flex-col gap-4">
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-orange-300">
        The Draft Room
      </span>
      <h1 className="font-sans text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl">
        The front office grades the prospect
      </h1>
      <p className="max-w-2xl text-base leading-relaxed text-neutral-300">
        A multi-persona panel pressure-tests a claim against the actual artifact — finding the gap
        between what’s claimed and what the code shows. The prospect on the board:{' '}
        <span className="text-orange-300">Courtfolio</span> itself.
      </p>

      <div className="mt-2 rounded-2xl border border-white/10 bg-neutral-800 p-5">
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-orange-300/80">
          The thesis under test
        </span>
        <ol className="mt-2 flex flex-col gap-2">
          {thesis.claims.map((c, i) => (
            <li key={i} className="flex gap-3 text-sm text-neutral-200">
              <span className="font-mono text-xs tabular-nums text-neutral-500">{i + 1}</span>
              <span>{c}</span>
            </li>
          ))}
        </ol>
      </div>

      {illustrative ? (
        <p className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-3 py-2 text-xs text-yellow-200/90">
          Illustrative — authored from a real terminal verdict. A live cross-family run will
          replace it; the mechanic and findings are real.
        </p>
      ) : null}

      {children}
    </header>
  )
}
