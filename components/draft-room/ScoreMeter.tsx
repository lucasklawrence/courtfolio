import { axisLabel } from './axes'

/** Props for {@link ScoreMeter}. */
interface ScoreMeterProps {
  /** Axis id (mapped to a display label). */
  axisId: string
  /** Score out of 10. */
  score: number
  /** Optional one-line rationale shown under the bar. */
  rationale?: string
}

/**
 * A labeled 0–10 score bar in the brand's spotlight orange. Presentational only.
 * The fill width encodes the score; the numeric value is shown for exactness and
 * is the accessible source of truth (the bar is `aria-hidden`).
 */
export function ScoreMeter({ axisId, score, rationale }: ScoreMeterProps) {
  const pct = Math.max(0, Math.min(10, score)) * 10
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-orange-300/80">
          {axisLabel(axisId)}
        </span>
        <span className="font-sans text-sm font-bold tabular-nums text-orange-400">{score}/10</span>
      </div>
      <div
        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
        aria-hidden="true"
      >
        <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
      </div>
      {rationale ? <p className="mt-1 text-xs leading-snug text-neutral-400">{rationale}</p> : null}
    </div>
  )
}
