import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { OtfData } from '@/types/otf'

import { OtfDetailView } from './OtfDetailView'

/**
 * Render tests for the OTF detail view (#256). Sessions, the milestone ladder
 * and admin state all arrive as props now that the page reads them server-side
 * (#345), so there is nothing to mock and nothing async to settle — the tests
 * focus on branch decisions (data, empty state, error panel) rather than chart
 * geometry. Heavy SVG chart children are still stubbed to `null`.
 * Sibling pattern: `StairDetailView.test.tsx`.
 */

/** Render with the default surrounding props; only `otf` usually varies. */
function renderView(props: Partial<React.ComponentProps<typeof OtfDetailView>> = {}) {
  return render(<OtfDetailView otf={null} mileageAwards={[]} isAdmin={false} {...props} />)
}

vi.mock('./OtfZoneBars', () => ({
  // Reports the width it receives so chart sizing stays observable while the
  // real SVG stays stubbed out.
  OtfZoneBars: ({ width }: { width: number }) => (
    <div data-testid="chart-probe" data-chart-width={width} />
  ),
}))
vi.mock('./OtfSparklineSummary', () => ({ OtfSparklineSummary: () => null }))
vi.mock('@/components/training-facility/shared/charts/RoughLine', () => ({ RoughLine: () => null }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/training-facility/gym/otf',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const VALID_SESSION = {
  started_at: '2026-06-27T16:30:00+00:00',
  studio: 'Marina Del Rey, CA',
  splat: 15,
  calories: 776,
  avg_hr: 133,
  peak_hr: 164,
  zones_min: { gray: 1, blue: 11, green: 29, orange: 14, red: 1 },
  treadmill: { distance_mi: 1.09, time: '16:44' },
  rower: { distance_m: 2509, time: '13:54' },
}

const DATA: OtfData = {
  imported_at: '2026-06-30T07:53:00+00:00',
  sessions: [VALID_SESSION],
}

/** One valid class + one auto-excluded belt-malfunction anomaly (#268). */
const DATA_WITH_EXCLUDED: OtfData = {
  imported_at: '2026-06-30T07:53:00+00:00',
  sessions: [
    {
      started_at: '2026-05-30T16:30:00+00:00',
      studio: 'Marina Del Rey, CA',
      splat: 0,
      calories: 4,
      avg_hr: 94,
      peak_hr: 95,
      excluded: true,
      excluded_reason: 'auto: near-zero output with no treadmill or rower block',
    },
    VALID_SESSION,
  ],
}

/** Three classes of three distinct inferred types, for the class-type filter (#271). */
const MULTI_TYPE_DATA: OtfData = {
  imported_at: '2026-06-30T07:53:00+00:00',
  sessions: [
    {
      started_at: '2026-06-20T16:30:00+00:00',
      splat: 8,
      calories: 668,
      class_type: 'Row-focused',
    },
    {
      started_at: '2026-06-24T16:30:00+00:00',
      splat: 13,
      calories: 697,
      class_type: 'Tread-focused',
    },
    { ...VALID_SESSION, class_type: 'Tread + Row' },
  ],
}

describe('OtfDetailView', () => {
  it('always renders the header and a link back to the Gym', () => {
    renderView({ otf: DATA })
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /the gym/i })).toHaveAttribute(
      'href',
      '/training-facility/gym'
    )
  })

  it('renders the highlights strip and session log once data loads', () => {
    renderView({ otf: DATA })
    // Highlights strip (unique tile label) + the session-log heading.
    expect(screen.getByText('Total splat')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /classes/i })).toBeInTheDocument()
    // Splat value appears in both the tile and the table; just assert presence.
    expect(screen.getAllByText('15').length).toBeGreaterThan(0)
  })

  it('lists an excluded session in the log with a badge but keeps it out of the class count (#268)', () => {
    renderView({ otf: DATA_WITH_EXCLUDED })
    // The anomaly stays in the log — 4 cal is its row, not an aggregate.
    expect(within(screen.getByRole('table')).getByText('4')).toBeInTheDocument()
    // …flagged with an "Excluded" badge carrying the reason as its title.
    const badge = screen.getByText('Excluded')
    expect(badge).toHaveAttribute('title', expect.stringContaining('near-zero output'))
    // …and counted separately: 1 valid class in range, 1 excluded.
    expect(screen.getByText(/1 in range/)).toBeInTheDocument()
    expect(screen.getByText(/1 excluded/)).toBeInTheDocument()
    // Aggregates run over active sessions only: total calories is 776 (the
    // valid class), not 780 — the anomaly's 4 cal is left out.
    const calTile = screen.getByText('Total calories').closest('div') as HTMLElement
    expect(within(calTile).getByText('776')).toBeInTheDocument()
  })

  it("shows each session's class type in the log Type column (#271)", () => {
    renderView({ otf: MULTI_TYPE_DATA })
    const table = screen.getByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Type' })).toBeInTheDocument()
    // Scope to the table so the filter pills (same labels) don't collide.
    expect(within(table).getByText('Tread + Row')).toBeInTheDocument()
    expect(within(table).getByText('Tread-focused')).toBeInTheDocument()
    expect(within(table).getByText('Row-focused')).toBeInTheDocument()
  })

  it('scopes the whole view to a picked class type, composing with the range (#271)', () => {
    renderView({ otf: MULTI_TYPE_DATA })
    // All three classes present before filtering, identified by their
    // distinct calorie totals. Scoped to the table throughout: the highlights
    // tiles show sums, and a filtered sum can equal a surviving row's value.
    const rows = () => within(screen.getByRole('table'))
    expect(rows().getByText('668')).toBeInTheDocument()
    expect(rows().getByText('697')).toBeInTheDocument()
    expect(rows().getByText('776')).toBeInTheDocument()
    // "All" starts pressed (unfiltered); the type pills do not.
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    // Pick the Tread-focused pill (a button — disambiguates from the Type cell).
    fireEvent.click(screen.getByRole('button', { name: 'Tread-focused' }))
    // Only the tread-only class stays in the log…
    expect(rows().getByText('697')).toBeInTheDocument()
    expect(rows().queryByText('776')).not.toBeInTheDocument()
    expect(rows().queryByText('668')).not.toBeInTheDocument()
    // …the aggregates follow: 1 class in range…
    expect(screen.getByText(/1 in range/)).toBeInTheDocument()
    // …and the selected state is exposed to assistive tech.
    expect(screen.getByRole('button', { name: 'Tread-focused', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('marks a booking-resolved class format in the log (#453)', () => {
    renderView({
      otf: {
        imported_at: '2026-06-30T07:53:00+00:00',
        sessions: [
          {
            ...VALID_SESSION,
            class_type: 'Tread + Row',
            class_format: '2G',
            class_format_source: 'booking' as const,
          },
        ],
      },
    })
    // The real template wins over the inferred label, and the title says where
    // it came from — the inference can't tell a 2G from a 3G.
    expect(screen.getByText('2G')).toHaveAttribute('title', 'From the booking calendar')
    expect(screen.queryByText('Tread + Row')).not.toBeInTheDocument()
  })

  it('distinguishes a hand-labeled drop-in from a booking match (#453)', () => {
    renderView({
      otf: {
        imported_at: '2026-06-30T07:53:00+00:00',
        sessions: [
          {
            ...VALID_SESSION,
            class_type: 'Tread-focused',
            class_format: 'Tread 50',
            class_format_source: 'manual' as const,
          },
        ],
      },
    })
    expect(screen.getByText('Tread 50')).toHaveAttribute('title', 'Manually labeled')
  })

  it('falls back to the inferred label with no provenance marker (#271)', () => {
    renderView({
      otf: {
        imported_at: '2026-06-30T07:53:00+00:00',
        sessions: [{ ...VALID_SESSION, class_type: 'Tread + Row' }],
      },
    })
    expect(screen.getByText('Tread + Row')).toHaveAttribute(
      'title',
      'Inferred from machine signature'
    )
  })

  it('shows the empty state when there are no sessions', () => {
    renderView({ otf: null })
    expect(screen.getByText(/no orangetheory classes yet/i)).toBeInTheDocument()
  })

  it('shows the error panel when the load throws', () => {
    renderView({ loadError: 'boom' })
    expect(screen.getByRole('alert')).toHaveTextContent(/boom/)
  })
})

/**
 * Chart sizing across the two layouts (#355 and its follow-up).
 *
 * The floor has been wrong in both directions now: too low, so mobile squeezed
 * a season of classes into ~330px with nothing to scroll; then too high, so
 * every desktop chart overflowed its 412px column and hid its right edge. The
 * two card widths are only ~80px apart, so the rule keys off the *breakpoint*
 * rather than the measured width — these pin both ends.
 */
describe('OtfDetailView chart width', () => {
  /** Stub `matchMedia` for a given two-column verdict, plus a no-op observer. */
  function stubLayout(twoColumn: boolean) {
    const listeners: Array<() => void> = []
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: twoColumn,
      media: query,
      addEventListener: (_: string, fn: () => void) => listeners.push(fn),
      removeEventListener: () => {},
    }))
    // jsdom has no ResizeObserver; report a realistic card width for the layout.
    const width = twoColumn ? 412 : 330
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private cb: ResizeObserverCallback) {}
        observe() {
          this.cb(
            [{ contentRect: { width } } as unknown as ResizeObserverEntry],
            this as unknown as ResizeObserver
          )
        }
        unobserve() {}
        disconnect() {}
      }
    )
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /**
   * Width handed to the charts, read off the stubbed child.
   *
   * Throws rather than defaulting when no probe rendered: an earlier draft of
   * this suite measured `svg[width]`, found nothing (the charts are stubbed),
   * and the desktop assertion passed on `0 <= 412` while checking nothing at
   * all.
   */
  function chartWidth(container: HTMLElement): number {
    const probe = container.querySelector('[data-chart-width]')
    if (!probe) throw new Error('no chart rendered — the assertion would be vacuous')
    return Number(probe.getAttribute('data-chart-width'))
  }

  it('overflows its card on a phone so the scroll container has something to scroll', () => {
    stubLayout(false)
    const { container } = renderView({ otf: DATA })
    // Wider than the ~330px card: that overflow is what makes it draggable.
    expect(chartWidth(container)).toBeGreaterThan(330)
  })

  it('asks the browser about the same breakpoint the CSS uses', () => {
    // Tailwind v4 defines `lg` as `64rem`, so a px query would disagree with
    // the grid whenever the root font size is not 16px — and reapply the
    // mobile floor to a desktop column.
    const seen: string[] = []
    vi.stubGlobal('matchMedia', (query: string) => {
      seen.push(query)
      return {
        matches: true,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }
    })
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
    renderView({ otf: DATA })
    expect(seen).toContain('(min-width: 64rem)')
  })

  it('never exceeds the 412px column on desktop', () => {
    stubLayout(true)
    const { container } = renderView({ otf: DATA })
    // Anything wider clips the chart's right edge behind a scrollbar.
    expect(chartWidth(container)).toBeLessThanOrEqual(412)
  })
})
