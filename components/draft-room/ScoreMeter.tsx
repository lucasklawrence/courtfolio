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
 * A labeled 0–10 grade bar, styled as a line item in the GRADES block of a
 * printed scouting report (ink on paper — this renders inside the paper-toned
 * {@link PersonaVerdictCard}). Presentational only. The fill width encodes
 * the score; the numeric value is shown for exactness and is the accessible
 * source of truth (the bar is `aria-hidden`).
 */
export function ScoreMeter({ axisId, score, rationale }: ScoreMeterProps) {
  const pct = Math.max(0, Math.min(10, score)) * 10
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-neutral-600">
          {axisLabel(axisId)}
        </span>
        <span className="font-mono text-sm font-bold tabular-nums text-neutral-900">
          {score}/10
        </span>
      </div>
      <div
        className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-neutral-900/10"
        aria-hidden="true"
      >
        <div className="h-full bg-orange-600" style={{ width: `${pct}%` }} />
      </div>
      {rationale ? (
        <p className="mt-1 text-xs leading-snug text-neutral-600">{rationale}</p>
      ) : null}
    </div>
  )
}
