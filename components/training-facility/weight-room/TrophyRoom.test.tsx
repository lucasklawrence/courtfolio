import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

import { buildTrophyRoomView } from '@/lib/training-facility/achievements'
import type { ExerciseGoal, StrengthSet, WeightRoomAchievement } from '@/types/weight-room'

import { TrophyRoom } from './TrophyRoom'

/** BannerCard animates via framer-motion's `m`, which needs a LazyMotion ancestor. */
vi.mock('framer-motion', async () => {
  const react = await import('react')
  return {
    m: new Proxy(
      {},
      {
        get: (_target, tag: string) =>
          function MockMotion({
            children,
            ...props
          }: React.PropsWithChildren<Record<string, unknown>>) {
            // Drop the animation-only props so they don't leak to the DOM as
            // unknown attributes and pollute the test output with warnings.
            const { animate: _a, transition: _t, initial: _i, ...rest } = props
            return react.createElement(tag, rest, children)
          },
      },
    ),
  }
})

const GOALS: ExerciseGoal[] = [
  { exercise: 'pushups', daily_target: 100, color: '#EA580C' },
  { exercise: 'pullups', daily_target: 30, color: '#0EA5A1' },
]

/** `19:00Z` is midday Pacific year-round, so `day` is the bucket regardless of runner timezone. */
function set(day: string, exercise: string, reps: number): StrengthSet {
  return { id: `${exercise}-${day}-${reps}`, logged_at: `${day}T19:00:00Z`, exercise, reps }
}

function tier(
  id: string,
  exercise: string | null,
  scope: WeightRoomAchievement['scope'],
  threshold: number,
  label: string,
): WeightRoomAchievement {
  return { id, label, exercise, scope, threshold }
}

const LADDER: WeightRoomAchievement[] = [
  tier('a', 'pushups', 'day', 100, 'Century Club'),
  tier('b', 'pushups', 'day', 250, 'Double and a Half'),
  tier('c', 'pushups', 'lifetime', 10000, 'Ten Thousand Club'),
  tier('d', 'pullups', 'day', 50, 'Half Century'),
  tier('e', null, 'streak', 30, 'Month of Work'),
]

/** 150 pushups + 60 pullups on one day — earns the two 'day' tiers, nothing else. */
const SETS: StrengthSet[] = [set('2026-07-14', 'pushups', 150), set('2026-07-14', 'pullups', 60)]

function renderRoom(
  sets: StrengthSet[] = SETS,
  ladder: WeightRoomAchievement[] = LADDER,
): ReturnType<typeof render> {
  return render(<TrophyRoom view={buildTrophyRoomView(sets, GOALS, ladder)} />)
}

describe('TrophyRoom', () => {
  it('renders the empty state when no tiers are configured', () => {
    renderRoom(SETS, [])
    expect(screen.getByTestId('trophy-room-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('trophy-room')).not.toBeInTheDocument()
  })

  it('shows the overall raised tally', () => {
    renderRoom()
    const tally = screen.getByTestId('trophy-tally')
    expect(within(tally).getByText('2')).toBeInTheDocument()
    expect(within(tally).getByText('of 5 raised')).toBeInTheDocument()
    expect(within(tally).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
  })

  it('marks earned badges as earned and unearned ones as not', () => {
    renderRoom()
    expect(screen.getByTestId('trophy-badge-a')).toHaveAttribute('data-earned', 'true')
    expect(screen.getByTestId('trophy-badge-d')).toHaveAttribute('data-earned', 'true')
    expect(screen.getByTestId('trophy-badge-b')).toHaveAttribute('data-earned', 'false')
    expect(screen.getByTestId('trophy-badge-e')).toHaveAttribute('data-earned', 'false')
  })

  it('dates an earned badge with the day it was first earned', () => {
    renderRoom()
    expect(within(screen.getByTestId('trophy-badge-a')).getByText(/Raised Jul 14, 2026/)).toBeInTheDocument()
  })

  it('shows how far an unearned badge has to go, in its own units', () => {
    renderRoom()
    // 150 of a 250-rep day.
    expect(
      within(screen.getByTestId('trophy-badge-b')).getByText(/best 150 · 100 reps to go/),
    ).toBeInTheDocument()
    // A streak threshold counts days, not reps. The single logged day hits the
    // pushups goal, so the pooled streak stands at 1 of 30.
    expect(
      within(screen.getByTestId('trophy-badge-e')).getByText(/best 1 · 29 days to go/),
    ).toBeInTheDocument()
  })

  it('describes what each tier measures alongside its label', () => {
    renderRoom()
    const badge = within(screen.getByTestId('trophy-badge-c'))
    expect(badge.getByText('Ten Thousand Club')).toBeInTheDocument()
    expect(badge.getByText('10,000 reps all-time')).toBeInTheDocument()
  })

  it('groups the wall by movement with the pooled ladder first', () => {
    renderRoom()
    expect(screen.getByTestId('trophy-group-pooled')).toBeInTheDocument()
    expect(screen.getByTestId('trophy-group-pushups')).toBeInTheDocument()
    expect(screen.getByTestId('trophy-group-pullups')).toBeInTheDocument()

    const groups = screen.getAllByTestId(/^trophy-group-/)
    expect(groups[0]).toHaveAttribute('data-testid', 'trophy-group-pooled')
  })

  it('tallies earned counts per group', () => {
    renderRoom()
    const pushups = within(screen.getByTestId('trophy-group-pushups'))
    expect(pushups.getByText('1 / 3 raised')).toBeInTheDocument()
  })

  it('hangs a banner for each recently earned achievement', () => {
    renderRoom()
    const recent = screen.getByRole('region', { name: 'Recently raised banners' })
    expect(within(recent).getByText('Century Club')).toBeInTheDocument()
    expect(within(recent).getByText('Half Century')).toBeInTheDocument()
    expect(within(recent).queryByText('Ten Thousand Club')).not.toBeInTheDocument()
  })

  it('lists in-progress achievements ranked by how close they are', () => {
    renderRoom()
    const chase = screen.getByRole('region', { name: 'Achievements in progress' })
    // pushups day-250 is at 60%, the pooled 30-day streak at 1/30 (~3%), and
    // pushups lifetime-10000 at 210/10000 (~2%).
    const cards = within(chase).getAllByTestId(/^trophy-chase-/)
    expect(cards.map((c) => c.getAttribute('data-testid'))).toEqual([
      'trophy-chase-b',
      'trophy-chase-e',
      'trophy-chase-c',
    ])
    expect(within(cards[0]).getByText('60%')).toBeInTheDocument()
  })

  it('omits both strips when nothing is earned and nothing is in progress', () => {
    renderRoom([], LADDER)
    expect(screen.queryByRole('region', { name: 'Recently raised banners' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Achievements in progress' }),
    ).not.toBeInTheDocument()
    // The full wall still renders — that's the point of an unearned ladder.
    expect(screen.getByRole('region', { name: 'Full achievement ladder' })).toBeInTheDocument()
  })

  it('notes when a badge has been earned more than once', () => {
    const repeats = [
      set('2026-07-14', 'pushups', 120),
      set('2026-07-15', 'pushups', 130),
      set('2026-07-16', 'pushups', 110),
    ]
    renderRoom(repeats, [tier('a', 'pushups', 'day', 100, 'Century Club')])
    expect(within(screen.getByTestId('trophy-badge-a')).getByText(/×3/)).toBeInTheDocument()
  })
})

describe('TrophyRoom — repeatable badges', () => {
  const CENTURY = [tier('a', 'pushups', 'day', 100, 'Century Club')]

  it('leads with the most recent earn and dates the first one separately', () => {
    const repeats = [
      set('2026-07-14', 'pushups', 120),
      set('2026-07-20', 'pushups', 130),
      set('2026-07-24', 'pushups', 110),
    ]
    renderRoom(repeats, CENTURY)
    const badge = within(screen.getByTestId('trophy-badge-a'))
    expect(badge.getByText('Last Jul 24, 2026')).toBeInTheDocument()
    expect(badge.getByText('first Jul 14, 2026')).toBeInTheDocument()
    expect(badge.getByText('×3')).toBeInTheDocument()
  })

  it('says "Raised" with no repeat chip for a badge earned exactly once', () => {
    renderRoom([set('2026-07-14', 'pushups', 120)], CENTURY)
    const badge = within(screen.getByTestId('trophy-badge-a'))
    expect(badge.getByText('Raised Jul 14, 2026')).toBeInTheDocument()
    expect(badge.queryByText(/^×/)).not.toBeInTheDocument()
    expect(badge.queryByText(/^first /)).not.toBeInTheDocument()
  })

  it('bubbles a re-earned banner back to the front of the rafters', () => {
    const ladder = [
      tier('a', 'pushups', 'day', 100, 'Century Club'),
      tier('d', 'pullups', 'day', 50, 'Half Century'),
    ]
    const sets = [
      // Century Club earned first, but re-earned most recently — so it should
      // lead the strip even though Half Century's only earn came in between.
      set('2026-07-01', 'pushups', 120),
      set('2026-07-10', 'pullups', 60),
      set('2026-07-24', 'pushups', 150),
    ]
    renderRoom(sets, ladder)
    const recent = screen.getByRole('region', { name: 'Recently raised banners' })
    const titles = within(recent)
      .getAllByText(/Century Club|Half Century/)
      .map((n) => n.textContent)
    expect(titles[0]).toBe('Century Club ×2')
    expect(titles[1]).toBe('Half Century')
  })

  it('shows a lifetime badge as a one-time earn even after piling on reps', () => {
    const sets = [
      set('2026-07-01', 'pushups', 600),
      set('2026-07-02', 'pushups', 600),
      set('2026-07-03', 'pushups', 600),
    ]
    renderRoom(sets, [tier('L', 'pushups', 'lifetime', 1000, 'Grand Club')])
    const badge = within(screen.getByTestId('trophy-badge-L'))
    expect(badge.getByText('Raised Jul 2, 2026')).toBeInTheDocument()
    expect(badge.queryByText(/^×/)).not.toBeInTheDocument()
  })
})
