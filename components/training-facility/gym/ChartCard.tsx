import type { JSX } from 'react'

/** Props for {@link ChartCard}. */
export interface ChartCardProps {
  /** Section title displayed in the upper-left of the card header. */
  title: string
  /** Sub-line description rendered between the header and chart body. */
  helper: string
  /** When set, the card sits full-width (used for the training-load row). */
  wide?: boolean
  /** Optional content rendered after the chart body — e.g. a legend. */
  footer?: JSX.Element
  /**
   * Optional control rendered to the right of the title — used by the
   * Training Load card to host the max-HR override. Wraps to the next line
   * on narrow screens via the parent header's `flex-wrap`.
   */
  headerSlot?: JSX.Element
  /** Chart body — usually one of the gym/lifestyle SVG charts. */
  children: JSX.Element
}

/**
 * Cream-card chrome used by every cardio + lifestyle chart on the All
 * Cardio Overview. Pulled out of `AllCardioOverview.tsx` so the
 * extracted {@link LifestyleMetricsSection} can reuse it without
 * pulling its parent module along (would have caused a cyclic
 * import). Visual / layout behavior unchanged from the inline version.
 */
export function ChartCard({
  title,
  helper,
  wide,
  footer,
  headerSlot,
  children,
}: ChartCardProps): JSX.Element {
  return (
    <section
      className={`${wide ? 'mt-6 ' : ''}rounded-[1.6rem] border border-white/10 bg-[#f5f1e6] p-5 text-[#0a0a0a] shadow-[0_18px_46px_rgba(0,0,0,0.34)]`}
    >
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-[#0a0a0a]">
          {title}
        </h2>
        {headerSlot}
      </header>
      <p className="mb-4 text-xs leading-5 text-[#404040]">{helper}</p>
      <div className="overflow-x-auto">{children}</div>
      {footer}
    </section>
  )
}
