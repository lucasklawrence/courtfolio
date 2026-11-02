'use client'

import type { JSX } from 'react'

import type { WeightRoomData } from '@/types/weight-room'

import { ActivityRings } from './ActivityRings'
import { useTodayBoard } from './useTodayBoard'

/** Props for {@link TodayProgressPanel}. */
export interface TodayProgressPanelProps {
  /** Today's strength dataset; `null` while nothing has loaded. */
  data: WeightRoomData | null
  /** Optional Tailwind classes appended to the outer `<section>`. */
  className?: string
}

/**
 * Today's rings and per-goal counts as ordinary page content, for screens where
 * the scene's wall fixture is too small to read. At phone width the 1600-unit
 * scene draws its text at a quarter of its size, so shrinking the drawing can't
 * make it legible; this states the same board at a readable size instead.
 *
 * Goal names stay in the text color rather than each goal's ring color, because
 * a configured color can be too dark to read on this background. The color dot
 * carries the link back to the ring.
 */
export function TodayProgressPanel({
  data,
  className = '',
}: TodayProgressPanelProps): JSX.Element | null {
  const board = useTodayBoard(data)
  if (board.length === 0) return null

  return (
    <section
      aria-label="Today's progress"
      data-testid="today-progress-panel"
      className={`rounded-2xl border border-white/10 bg-black/30 p-4 ${className}`}
    >
      <div className="flex justify-center">
        <ActivityRings
          rings={board.map(row => ({ goal: row.goal, totalReps: row.total }))}
          size={208}
          showReadout={false}
        />
      </div>
      <ul className="mt-4 divide-y divide-white/10">
        {board.map(row => (
          <li
            key={row.goal.exercise}
            data-testid={`today-row-${row.goal.exercise}`}
            className="flex items-start justify-between gap-3 py-2.5 text-base"
          >
            <span className="flex min-w-0 items-start gap-2.5">
              <span
                aria-hidden="true"
                className="mt-1.5 size-3 shrink-0 rounded-full"
                style={{ backgroundColor: row.goal.color }}
              />
              <span className="min-w-0 break-words text-[#f7ead9]">{row.label}</span>
            </span>
            <span className="shrink-0 text-right font-mono tabular-nums text-white">
              {row.total}
              <span className="text-white/60"> / {row.goal.daily_target}</span>
              {row.streak > 0 ? (
                <span className="block text-sm text-amber-200">
                  <span aria-hidden="true">🔥</span>
                  {row.streak}d<span className="sr-only"> streak</span>
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
