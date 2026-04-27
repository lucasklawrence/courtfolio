'use client'

type TrainingFacilityCourtEntryProps = {
  /**
   * Optional DOM id used for a11y targeting and future guided-tour steps.
   */
  id?: string

  /**
   * Invoked when the visitor activates the court-side tunnel entry.
   */
  onClick?: () => void
}

/**
 * Court-side tunnel marker that links the main court into the Training Facility.
 *
 * The visual treatment intentionally reads like an in-world doorway rather than
 * another utility button stacked with the top-right navigation controls.
 */
export function TrainingFacilityCourtEntry({
  id,
  onClick,
}: TrainingFacilityCourtEntryProps) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      aria-label="Enter the Training Facility"
      className="group flex h-full w-full cursor-pointer flex-col justify-between rounded-[28px] border-2 border-amber-300/80 bg-[#2d180f]/95 p-3 text-amber-50 shadow-[0_16px_28px_rgba(0,0,0,0.35)] transition duration-200 hover:-translate-y-1 hover:bg-[#3a2014] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
    >
      <div className="rounded-full border border-amber-200/35 bg-black/20 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.32em] text-amber-100">
        Training Facility
      </div>

      <div className="mx-auto flex h-20 w-24 items-end justify-center rounded-t-[999px] rounded-b-lg border border-amber-100/25 bg-gradient-to-b from-[#5a331d] via-[#24130c] to-[#120905] px-3 pb-3 shadow-inner">
        <div className="w-full rounded-t-[999px] rounded-b-md border border-dashed border-amber-100/20 bg-black/45 px-2 py-2 text-center text-[9px] font-semibold uppercase tracking-[0.28em] text-amber-100/85">
          Gym
          <br />
          Combine
        </div>
      </div>

      <div className="text-center text-[10px] font-medium uppercase tracking-[0.22em] text-amber-100/80">
        Enter tunnel
      </div>
    </button>
  )
}
