'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type JSX } from 'react'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { getCardioData, getOtfData } from '@/lib/data'
import {
  averageOf,
  bandForBpm,
  buildHrZoneComparison,
  type SystemZoneComparison,
  type ZoneTimeShare,
} from '@/lib/training-facility/hr-zone-comparison'
import type { CardioData } from '@/types/cardio'
import type { OtfData } from '@/types/otf'

/**
 * Apple-vs-OrangeTheory HR-zone reconciliation view (#261). Loads both the
 * Apple cardio dataset and the OTbeat session data, derives one shared maxHR
 * from observed peaks, and renders each system's personal bpm boundaries and
 * time-in-zone side by side — explicitly as two different band systems, not a
 * one-to-one mapping. Ends with a short recommendation on which to treat as the
 * canonical cross-session model.
 *
 * Self-contained (own dark-arena shell + loading/error panels), matching the
 * sibling `OtfDetailView`; reached from a link in that view's header.
 */
export function HrZoneComparison(): JSX.Element {
  const [cardio, setCardio] = useState<CardioData | null>(null)
  const [otf, setOtf] = useState<OtfData | null>(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getCardioData().catch(() => null), getOtfData().catch(() => null)])
      .then(([cardioData, otfData]) => {
        if (cancelled) return
        // A total failure of both reads surfaces as the error panel; a single
        // source being empty is fine — the comparison still renders the other.
        if (cardioData === null && otfData === null) {
          setLoadError(new Error('No cardio or OrangeTheory data available yet.'))
        }
        setCardio(cardioData)
        setOtf(otfData)
        setReady(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err : new Error(String(err)))
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const otfSessions = useMemo(() => otf?.sessions ?? [], [otf])
  const cardioSessions = useMemo(() => cardio?.sessions ?? [], [cardio])

  const comparison = useMemo(
    () => buildHrZoneComparison(cardioSessions, otfSessions),
    [cardioSessions, otfSessions],
  )

  // Personal markers: average OTF peak / average HR placed against the bands.
  const avgPeak = useMemo(() => averageOf(otfSessions, 'peak_hr'), [otfSessions])
  const avgHr = useMemo(() => averageOf(otfSessions, 'avg_hr'), [otfSessions])

  const hasData = comparison.apple.total > 0 || comparison.otf.total > 0

  return (
    <div className="relative min-h-svh overflow-hidden bg-[#120d0a] text-[#f7ead9]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.12),transparent_30%),linear-gradient(180deg,#241811_0%,#120d0a_52%,#0b0806_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-5xl flex-col px-6 py-8 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <BackToCourtButton />
          <Link
            href="/training-facility/gym/otf"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:bg-white/10"
          >
            ← OrangeTheory
          </Link>
        </div>

        <header className="mt-12">
          <div className="text-xs font-semibold uppercase tracking-[0.38em] text-[#f97316]">
            Heart-rate zones
          </div>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-[0.08em] text-[#fff7ec] sm:text-5xl">
            Apple Watch vs OrangeTheory
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#e8d5be] sm:text-base">
            Two different 5-zone systems feed this dashboard — different band cut-points and
            different max-HR assumptions. Here they are on one shared, data-derived max HR, so
            &ldquo;what are my zones&rdquo; and &ldquo;what does my time actually look like&rdquo;
            are answerable at a glance. They&rsquo;re shown side by side, not mapped onto each
            other.
          </p>
        </header>

        {loadError ? (
          <ErrorPanel error={loadError} />
        ) : !ready ? (
          <LoadingPanel />
        ) : (
          <>
            <MaxHrCallout
              maxHr={comparison.maxHr}
              source={comparison.maxHrSource}
              observedPeak={comparison.observedPeak}
              avgPeak={avgPeak}
              avgHr={avgHr}
            />

            {!hasData ? (
              <EmptyState />
            ) : (
              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <SystemCard
                  system={comparison.apple}
                  helper="Even 10%-of-maxHR bands. We store raw HR samples and bucket them ourselves — this is the all-day model."
                  avgHr={avgHr}
                  avgPeak={avgPeak}
                />
                <SystemCard
                  system={comparison.otf}
                  helper="OTbeat's own uneven bands, arriving pre-bucketed as minutes. Orange + red minutes are splat points — the studio-effort model."
                  avgHr={avgHr}
                  avgPeak={avgPeak}
                />
              </div>
            )}

            <RecommendationNote source={comparison.maxHrSource} observedPeak={comparison.observedPeak} />
          </>
        )}
      </div>
    </div>
  )
}

/** Format a band's logged time — Apple stores seconds, OTF stores minutes — as a compact `Nm`. */
function formatBandTime(value: number, unit: SystemZoneComparison['unit']): string {
  const minutes = unit === 'seconds' ? value / 60 : value
  if (minutes <= 0) return '—'
  if (minutes < 1) return '<1m'
  return `${Math.round(minutes)}m`
}

/** The shared-maxHR callout: the value, where it came from, and the personal-average context. */
function MaxHrCallout({
  maxHr,
  source,
  observedPeak,
  avgPeak,
  avgHr,
}: {
  maxHr: number
  source: 'observed' | 'default'
  observedPeak: number | null
  avgPeak: number | null
  avgHr: number | null
}): JSX.Element {
  return (
    <section className="mt-8 rounded-[1.6rem] border border-white/10 bg-black/25 p-5">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-white/55">
            Shared max HR
          </p>
          <p className="mt-1 text-3xl font-black text-[#f97316]">
            {maxHr}
            <span className="ml-1 text-sm font-semibold text-white/50">bpm</span>
          </p>
        </div>
        <p className="max-w-md text-xs leading-6 text-white/65">
          {source === 'observed' ? (
            <>
              Derived from your highest observed peak
              {observedPeak !== null ? ` (${observedPeak} bpm)` : ''} across OrangeTheory classes
              and Apple cardio — a <em>floor</em>, since you may not have truly maxed out. It
              updates automatically as higher peaks land.
            </>
          ) : (
            <>
              No peak on file yet — falling back to the formula default ({maxHr} bpm). Both zone
              tables below will re-scale to your real peak once cardio or OrangeTheory data arrives.
            </>
          )}
        </p>
      </div>
      {(avgPeak !== null || avgHr !== null) && (
        <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-6 text-white/55">
          {avgPeak !== null ? `Avg OTF peak ${Math.round(avgPeak)} bpm. ` : ''}
          {avgHr !== null ? `Avg HR ${Math.round(avgHr)} bpm.` : ''}
        </p>
      )}
    </section>
  )
}

/** One system's card — personal bpm boundaries + time-in-zone strip + per-band rows. */
function SystemCard({
  system,
  helper,
  avgHr,
  avgPeak,
}: {
  system: SystemZoneComparison
  helper: string
  avgHr: number | null
  avgPeak: number | null
}): JSX.Element {
  const avgHrBand = avgHr !== null ? bandForBpm(system.bands, avgHr) : null
  const avgPeakBand = avgPeak !== null ? bandForBpm(system.bands, avgPeak) : null

  return (
    <section className="rounded-[1.6rem] border border-white/10 bg-[#f5f1e6] p-5 text-[#0a0a0a] shadow-[0_18px_46px_rgba(0,0,0,0.34)]">
      <header className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-[#0a0a0a]">
          {system.label}
        </h2>
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#404040]">
          {formatBandTime(system.total, system.unit)} logged
        </span>
      </header>
      <p className="mb-4 text-xs leading-5 text-[#404040]">{helper}</p>

      <ZoneShareStrip system={system} />

      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-[#737373]">
            <th scope="col" className="pb-1 font-semibold">
              Zone
            </th>
            <th scope="col" className="pb-1 font-semibold">
              BPM
            </th>
            <th scope="col" className="pb-1 text-right font-semibold">
              Time
            </th>
            <th scope="col" className="pb-1 text-right font-semibold">
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {system.bands.map(band => (
            <tr key={band.key} className="align-middle">
              <td className="py-1">
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: band.color }}
                  />
                  <span className="font-semibold text-[#0a0a0a]">{band.shortLabel}</span>
                  <span className="text-[#737373]">{band.label}</span>
                </span>
              </td>
              <td className="py-1 font-mono text-[#404040]">
                {band.minBpm}–{band.maxBpm}
              </td>
              <td className="py-1 text-right font-mono text-[#404040]">
                {formatBandTime(band.value, system.unit)}
              </td>
              <td className="py-1 text-right font-mono text-[#0a0a0a]">
                {system.total > 0 ? `${Math.round(band.share * 100)}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(avgHrBand || avgPeakBand) && (
        <p className="mt-3 border-t border-black/10 pt-3 text-xs leading-6 text-[#404040]">
          {avgHrBand ? (
            <>
              Avg HR lands in <ZoneChip band={avgHrBand} />.{' '}
            </>
          ) : null}
          {avgPeakBand ? (
            <>
              Avg peak lands in <ZoneChip band={avgPeakBand} />.
            </>
          ) : null}
        </p>
      )}
    </section>
  )
}

/** Inline colored zone name — a small swatch + label used in the avg-HR/peak sentence. */
function ZoneChip({ band }: { band: ZoneTimeShare }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-[#0a0a0a]">
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-sm"
        style={{ backgroundColor: band.color }}
      />
      {band.shortLabel}
    </span>
  )
}

/**
 * Proportional time-in-zone strip — the {@link ZoneTimeShare} bands as adjacent
 * colored segments sized by `share`. Mirrors `SessionZoneStrip`'s look (rounded,
 * bordered, native-title tooltip) but takes the richer band shape so it works
 * for both the 5 Apple zones and the 5 OTF zones. Renders an em-dash when the
 * system logged no time.
 */
function ZoneShareStrip({ system }: { system: SystemZoneComparison }): JSX.Element {
  if (system.total <= 0) {
    return (
      <span aria-label="No zone data" className="font-mono text-[#737373]">
        —
      </span>
    )
  }
  const tooltip = system.bands
    .map(b => `${b.shortLabel}: ${formatBandTime(b.value, system.unit)}`)
    .join(', ')
  return (
    <span
      role="img"
      aria-label={`${system.label} time in zone — ${tooltip}`}
      title={tooltip}
      className="flex h-3 w-full overflow-hidden rounded-sm border border-black/15"
    >
      {system.bands.map(band => {
        if (band.share <= 0) return null
        return (
          <span
            key={band.key}
            data-testid={`share-segment-${system.system}-${band.key}`}
            aria-hidden="true"
            className="h-full"
            style={{ width: `${band.share * 100}%`, backgroundColor: band.color }}
          />
        )
      })}
    </span>
  )
}

/** Short recommendation on which model to treat as canonical, and why. */
function RecommendationNote({
  source,
  observedPeak,
}: {
  source: 'observed' | 'default'
  observedPeak: number | null
}): JSX.Element {
  return (
    <section className="mt-8 rounded-[1.6rem] border border-[#f97316]/25 bg-[#f97316]/5 p-5">
      <h2 className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-[#f97316]">
        Which to follow
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-[#e8d5be]">
        <p>
          For cross-session consistency, follow the <strong>Apple even-band model</strong> on the
          shared observed max HR
          {source === 'observed' && observedPeak !== null ? ` (${observedPeak} bpm)` : ''} as the
          canonical model. It&rsquo;s built from raw samples we control, so the same bpm means the
          same zone in every session — and it&rsquo;s the all-day model, not tied to one studio
          format.
        </p>
        <p>
          Keep OrangeTheory&rsquo;s bands as <strong>studio-effort context</strong>, not a second
          truth: its minutes arrive pre-bucketed off OTF&rsquo;s own age-based max HR, so they
          can&rsquo;t be re-bucketed to match. Read splat (orange + red) as &ldquo;how hard was that
          class,&rdquo; and read the Apple zones for everything cross-session.
        </p>
      </div>
    </section>
  )
}

function LoadingPanel(): JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-10 rounded-[1.6rem] border border-white/10 bg-black/25 p-8 text-center text-sm text-white/65"
    >
      Loading heart-rate data…
    </div>
  )
}

function EmptyState(): JSX.Element {
  return (
    <div className="mt-8 rounded-[1.6rem] border border-white/10 bg-black/25 p-8 text-center text-sm leading-6 text-white/65">
      <p className="font-semibold uppercase tracking-[0.18em] text-white/80">No time-in-zone yet</p>
      <p className="mt-2 text-white/55">
        The zone tables above show your boundaries; per-zone time fills in as cardio and
        OrangeTheory sessions land.
      </p>
    </div>
  )
}

function ErrorPanel({ error }: { error: Error }): JSX.Element {
  return (
    <div
      role="alert"
      className="mt-10 rounded-[1.6rem] border border-red-400/30 bg-red-950/40 p-6 text-sm leading-6 text-red-100"
    >
      <p className="font-semibold uppercase tracking-[0.18em]">Could not load heart-rate data</p>
      <p className="mt-2 text-red-100/80">{error.message}</p>
    </div>
  )
}
