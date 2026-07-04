import type { JSX } from 'react'

import { variantBreakdown, type VariantSlice } from '@/lib/training-facility/strength-today'
import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

/** Props for {@link VariantBreakdown}. */
export interface VariantBreakdownProps {
  /**
   * The full set log (all exercises). The component filters to
   * {@link VariantBreakdownProps.goal}'s exercise internally, so the
   * History page can pass the same `sets` array it hands every other
   * per-exercise child.
   */
  sets: readonly StrengthSet[]
  /** The exercise whose volume is being sliced, for its name + lane color. */
  goal: ExerciseGoal
}

/**
 * Per-intensity opacity applied to `goal.color` for a named-variant
 * segment, indexed by the slice's rank (0 = largest share). Mirrors the
 * StrengthHeatmap convention of one hex color at varied `opacity` rather
 * than pre-mixed shades, so a new exercise color needs no palette entry.
 * Ranks past the last entry clamp to it — rare (an exercise with 6+
 * distinct grips), and the legend disambiguates regardless.
 */
const VARIANT_OPACITY: readonly number[] = [0.95, 0.72, 0.54, 0.4, 0.3, 0.22] as const

/** Neutral fill for the "unspecified" (null-variant) slice — reads as "no grip". */
const UNSPECIFIED_FILL = 'rgba(247, 234, 217, 0.16)'

/** Legend/label text for the null-variant bucket. */
const UNSPECIFIED_LABEL = 'unspecified'

/**
 * Per-exercise variant breakdown for the History View (#254) — how an
 * exercise's all-time volume splits across the grips / widths / tempos
 * it was logged with (e.g. "pullups: 60% wide, 30% close, 10%
 * unspecified"). A stacked share bar over a legend of rep counts and
 * percentages.
 *
 * This is a *slice* of the same sets that feed the exercise's daily
 * ring — it never changes the rollup (see {@link variantBreakdown}). It
 * is progressive: an exercise logged without any grips has nothing to
 * break down, so the component renders `null` rather than a noisy "100%
 * unspecified" bar. Only once at least one set carries a variant does
 * the surface appear.
 *
 * Pure/presentational (no hooks) so it renders inside the History
 * page's Server Component alongside the heatmap and volume chart.
 */
export function VariantBreakdown({ sets, goal }: VariantBreakdownProps): JSX.Element | null {
  const exerciseSets = sets.filter((s) => s.exercise === goal.exercise)
  const slices = variantBreakdown(exerciseSets)
  const namedCount = slices.filter((s) => s.variant !== null).length

  // Nothing to break down until at least one grip has been tagged.
  if (namedCount === 0) return null

  const summary = slices
    .map((s) => `${sliceLabel(s)} ${Math.round(s.share * 100)}%`)
    .join(', ')

  return (
    <section
      data-testid={`variant-breakdown-${goal.exercise}`}
      aria-label={`${goal.exercise} variant breakdown`}
      className="mt-5 border-t border-white/10 pt-4"
    >
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#e8d5be]/60">
        Variant breakdown · all-time
      </p>

      <div
        role="img"
        aria-label={`${goal.exercise} by variant: ${summary}`}
        className="flex h-3 w-full overflow-hidden rounded-full bg-black/30"
      >
        {slices.map((slice, i) => (
          <span
            key={slice.variant ?? UNSPECIFIED_LABEL}
            className="h-full"
            style={{
              width: `${slice.share * 100}%`,
              backgroundColor: slice.variant === null ? UNSPECIFIED_FILL : goal.color,
              opacity: slice.variant === null ? 1 : opacityForRank(i),
            }}
          />
        ))}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {slices.map((slice, i) => (
          <li
            key={slice.variant ?? UNSPECIFIED_LABEL}
            data-testid={`variant-breakdown-${goal.exercise}-${slice.variant ?? UNSPECIFIED_LABEL}`}
            className="flex items-baseline gap-2 font-mono text-[11px]"
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 self-center rounded-full"
              style={{
                backgroundColor: slice.variant === null ? UNSPECIFIED_FILL : goal.color,
                opacity: slice.variant === null ? 1 : opacityForRank(i),
              }}
            />
            <span className="uppercase tracking-[0.16em] text-[#f7ead9]">
              {sliceLabel(slice)}
            </span>
            <span className="tabular-nums text-[#e8d5be]/60">
              {slice.reps} · {Math.round(slice.share * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Display label for a slice — the variant string, or the unspecified bucket's label. */
function sliceLabel(slice: VariantSlice): string {
  return slice.variant ?? UNSPECIFIED_LABEL
}

/** Opacity for a named-variant segment at rank `i`, clamped to the ramp's last entry. */
function opacityForRank(i: number): number {
  return VARIANT_OPACITY[Math.min(i, VARIANT_OPACITY.length - 1)]
}
