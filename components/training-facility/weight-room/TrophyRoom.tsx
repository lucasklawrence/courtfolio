import type { CSSProperties, JSX } from 'react'

import { BannerCard } from '@/components/common/BannerCard'
import {
  achievementIcon,
  achievementUnit,
  describeAchievement,
  formatEarnedOn,
  sectionLabel,
  type AchievementGroup,
  type ResolvedAchievement,
  type TrophyRoomView,
} from '@/lib/training-facility/achievements'

/**
 * Accent for a tier with no configured `color` and no exercise goal color to
 * inherit — the brand's banner yellow, matching the rafters banners.
 */
const DEFAULT_ACCENT = '#FACC15'

/** Props for {@link TrophyRoom}. */
export interface TrophyRoomProps {
  /**
   * The pre-resolved display model from
   * {@link import('@/lib/training-facility/achievements').buildTrophyRoomView}.
   * Computed by the page (a Server Component) so the badge math never ships to
   * the browser — the wall is a static render of a pure function's output.
   */
  view: TrophyRoomView
}

/**
 * Weight Room Trophy Room (#336) — the "grease the groove" achievement wall.
 *
 * Three tiers of reading, top to bottom: the banners most recently raised
 * (hung as swaying rafters banners, the brand's achievement language), the
 * badges closest to being earned, and then the full ladder grouped by movement.
 * Earned badges are lit in their tier color; unearned ones sit dimmed with a
 * progress bar, so the wall shows both what's been done and what's left.
 *
 * Renders as a Server Component — the only client boundary is
 * {@link BannerCard}, which owns the sway animation.
 */
export function TrophyRoom({ view }: TrophyRoomProps): JSX.Element {
  const { groups, earnedCount, totalCount, recent, nextUp } = view

  if (totalCount === 0) {
    return (
      <p
        data-testid="trophy-room-empty"
        className="rounded-[1.2rem] border border-white/10 bg-white/5 p-6 text-center text-sm text-[#e8d5be]/70"
      >
        No achievements configured yet — add a tier in Settings to start hanging banners.
      </p>
    )
  }

  return (
    <div data-testid="trophy-room" className="space-y-12">
      <TrophyTally earnedCount={earnedCount} totalCount={totalCount} />

      {recent.length > 0 ? (
        <section aria-label="Recently raised banners">
          <SectionHeading
            eyebrow="Recently raised"
            title="Up in the rafters"
            note="Newest first."
          />
          {/* Banners hang from the top edge and flare into a pennant below, so
              the row needs vertical room the flex gap alone doesn't give it. */}
          <div className="mt-8 flex flex-wrap justify-center gap-10 pb-12 sm:justify-start">
            {recent.map((entry, index) => (
              <BannerCard
                key={entry.achievement.id}
                // The most recent earn, so a re-earned banner reads as fresh
                // rather than showing a date from months ago.
                year={formatEarnedOn(entry.lastEarnedOn, entry.achievement.scope)}
                title={
                  entry.timesEarned > 1
                    ? `${entry.achievement.label} ×${entry.timesEarned.toLocaleString('en-US')}`
                    : entry.achievement.label
                }
                icon={achievementIcon(entry.achievement)}
                swayDelay={index * 0.4}
                swayAmount={1.2 + (index % 3) * 0.3}
              />
            ))}
          </div>
        </section>
      ) : null}

      {nextUp.length > 0 ? (
        <section aria-label="Achievements in progress">
          <SectionHeading
            eyebrow="Still chasing"
            title="Closest to the rafters"
            note="Ranked by how close each one is."
          />
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {nextUp.map((entry) => (
              <li key={entry.achievement.id}>
                <ChaseCard entry={entry} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Full achievement ladder">
        <SectionHeading
          eyebrow="The full wall"
          title="Every banner on offer"
          note="Grouped by movement."
        />
        <div className="mt-6 space-y-8">
          {groups.map((group) => (
            <GroupCard key={group.exercise ?? '*'} group={group} />
          ))}
        </div>
      </section>
    </div>
  )
}

/** The headline "N of M raised" counter with an overall completion bar. */
function TrophyTally({
  earnedCount,
  totalCount,
}: {
  earnedCount: number
  totalCount: number
}): JSX.Element {
  const pct = totalCount === 0 ? 0 : Math.round((earnedCount / totalCount) * 100)
  return (
    <section
      data-testid="trophy-tally"
      aria-label="Overall achievement progress"
      className="rounded-[1.2rem] border border-amber-200/20 bg-white/5 p-5 sm:p-6"
    >
      <p className="flex items-baseline gap-3">
        <span className="text-4xl font-black tabular-nums text-[#fff7ec] sm:text-5xl">
          {earnedCount}
        </span>
        <span className="font-mono text-sm uppercase tracking-[0.2em] text-amber-300/80">
          of {totalCount} raised
        </span>
      </p>
      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Banners raised"
      >
        <div className="h-full rounded-full bg-amber-300" style={{ width: `${pct}%` }} />
      </div>
    </section>
  )
}

/** Consistent eyebrow + title + note block above each section. */
function SectionHeading({
  eyebrow,
  title,
  note,
}: {
  eyebrow: string
  title: string
  note: string
}): JSX.Element {
  return (
    <header>
      <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-black uppercase tracking-[0.06em] text-[#fff7ec] sm:text-2xl">
        {title}
      </h2>
      <p className="mt-1 text-sm text-[#e8d5be]/60">{note}</p>
    </header>
  )
}

/** One exercise's (or the pooled ladder's) tiers, split into scope subsections. */
function GroupCard({ group }: { group: AchievementGroup }): JSX.Element {
  const accent = group.color ?? DEFAULT_ACCENT
  // Preserve the ordering the resolver already applied rather than re-sorting:
  // `achievements` arrives ordered by scope, then measure, then threshold, so
  // walking it in order yields subsections in the same intended sequence.
  //
  // Keyed by scope *and* measure — "100 reps in a day" and "10,000 lb in a day"
  // are different ladders and must not share a heading.
  const sections = new Map<string, { heading: string; entries: ResolvedAchievement[] }>()
  for (const entry of group.achievements) {
    const { scope } = entry.achievement
    const measure = entry.achievement.measure ?? 'reps'
    const key = `${scope}|${measure}`
    const bucket = sections.get(key)
    if (bucket) bucket.entries.push(entry)
    else sections.set(key, { heading: sectionLabel(scope, measure), entries: [entry] })
  }

  return (
    <article
      data-testid={`trophy-group-${group.exercise ?? 'pooled'}`}
      className="rounded-[1.2rem] border border-white/10 bg-white/5 p-5"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h3
          className="flex flex-wrap items-baseline gap-2 font-mono text-sm font-bold uppercase tracking-[0.2em]"
          style={{ color: accent }}
        >
          {group.label}
          {group.loadMultiplier > 1 ? (
            // Loads are logged per implement, so a two-dumbbell movement's
            // thresholds are double the number stamped on the weight. Say so
            // here rather than letting "120 lb" read as a typo.
            <span className="font-normal normal-case tracking-normal text-white/45">
              ×{group.loadMultiplier} implements · weights below are the total
            </span>
          ) : null}
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#e8d5be]/60">
          {group.earnedCount} / {group.achievements.length} raised
        </span>
      </header>

      <div className="mt-5 space-y-6">
        {[...sections.entries()].map(([key, section]) => (
          <section key={key} aria-label={`${group.label} — ${section.heading}`}>
            <h4 className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">
              {section.heading}
            </h4>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {section.entries.map((entry) => (
                <li key={entry.achievement.id}>
                  <BadgeTile entry={entry} accent={accent} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  )
}

/**
 * One tier on the wall. Earned tiles are lit in the tier's accent and carry the
 * date it was first earned; unearned tiles are dimmed, dashed, and show a
 * progress bar plus what's left to do.
 */
function BadgeTile({
  entry,
  accent,
}: {
  entry: ResolvedAchievement
  accent: string
}): JSX.Element {
  const { achievement, earned, best, progress, remaining, timesEarned } = entry
  const color = achievement.color ?? accent
  const pct = Math.round(progress * 100)
  const lastOn = formatEarnedOn(entry.lastEarnedOn, achievement.scope)
  const firstOn = formatEarnedOn(entry.firstEarnedOn, achievement.scope)
  const isRepeat = timesEarned > 1
  const unit = achievementUnit(achievement)

  const litStyle: CSSProperties = { borderColor: color, backgroundColor: `${color}14` }

  return (
    <div
      data-testid={`trophy-badge-${achievement.id}`}
      data-earned={earned}
      style={earned ? litStyle : undefined}
      className={
        earned
          ? 'h-full rounded-[0.9rem] border p-3'
          : 'h-full rounded-[0.9rem] border border-dashed border-white/12 bg-black/20 p-3'
      }
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className={earned ? 'text-xl leading-none' : 'text-xl leading-none opacity-30 grayscale'}
        >
          {achievementIcon(achievement)}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-bold"
            style={{ color: earned ? color : undefined }}
            // The truncated label stays reachable for anyone hovering or using
            // a screen reader when the tile is too narrow for the full name.
            title={achievement.label}
          >
            <span className={earned ? '' : 'text-white/55'}>{achievement.label}</span>
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
            {describeAchievement(achievement)}
          </p>
        </div>
      </div>

      {earned ? (
        <div className="mt-2.5">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">
            <span>{lastOn ? `${isRepeat ? 'Last' : 'Raised'} ${lastOn}` : 'Raised'}</span>
            {isRepeat ? (
              <span
                style={{ borderColor: color, color }}
                className="rounded-full border px-1.5 py-px text-[9px] tracking-[0.12em]"
                // The count is the point of a repeatable badge, so it gets its
                // own chip rather than trailing the date as plain text.
                title={`Earned ${timesEarned.toLocaleString('en-US')} times`}
              >
                ×{timesEarned.toLocaleString('en-US')}
              </span>
            ) : null}
          </p>
          {isRepeat && firstOn ? (
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
              first {firstOn}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-2.5">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-white/8"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress toward ${achievement.label}`}
          >
            <div
              className="h-full rounded-full opacity-60"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
            best {best.toLocaleString('en-US')} · {remaining.toLocaleString('en-US')} {unit} to go
          </p>
        </div>
      )}
    </div>
  )
}

/** A wider "closest to earning" card for the chase strip. */
function ChaseCard({ entry }: { entry: ResolvedAchievement }): JSX.Element {
  const { achievement, best, progress, remaining } = entry
  const color = achievement.color ?? DEFAULT_ACCENT
  const pct = Math.round(progress * 100)
  const unit = achievementUnit(achievement)
  const scopeOwner = achievement.exercise ?? 'all movements'

  return (
    <div
      data-testid={`trophy-chase-${achievement.id}`}
      className="h-full rounded-[1.1rem] border border-white/10 bg-black/25 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-[#fff7ec]">
            <span aria-hidden="true" className="text-base opacity-60">
              {achievementIcon(achievement)}
            </span>
            <span className="truncate">{achievement.label}</span>
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
            {scopeOwner} · {describeAchievement(achievement)}
          </p>
        </div>
        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-amber-200">
          {pct}%
        </span>
      </div>

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress toward ${achievement.label}`}
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
        best {best.toLocaleString('en-US')} · {remaining.toLocaleString('en-US')} {unit} to go
      </p>
    </div>
  )
}
