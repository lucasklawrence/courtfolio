import type { RunStartPersona } from '@/lib/draft-room/protocol'

/** The model chip's display text: strip the gateway vendor prefix (`anthropic/claude-haiku-4.5` → `claude-haiku-4.5`). */
function modelShortName(model: string): string {
  return model.split('/').pop() ?? model
}

/** Props for {@link PersonaPendingCard}. */
interface PersonaPendingCardProps {
  /** The persona this slot is waiting on, from the run-start roster. */
  persona: RunStartPersona
}

/**
 * A scout's report while their model call is in flight (#241): a blank
 * report form filling in. The model chip is the honesty detail: three
 * different vendors visibly deliberating at genuinely different speeds *is*
 * the independence proof. CSS pulse only — consistent with the repo's
 * CSS-first animation idiom.
 */
export function PersonaPendingCard({ persona }: PersonaPendingCardProps) {
  return (
    <article
      aria-label={`${persona.label} — deliberating`}
      className="flex h-full min-h-64 flex-col gap-3 rounded-md border border-neutral-900/20 bg-[#f5f0e4]/85 p-5 text-neutral-900 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
    >
      <span className="font-mono text-[0.625rem] font-bold uppercase tracking-[0.2em] text-neutral-700">
        Scouting report
      </span>
      <div className="flex flex-col gap-1 font-mono text-xs text-neutral-700">
        <div className="flex gap-2">
          <span className="uppercase tracking-[0.12em] text-neutral-500">Scout</span>
          <h3 className="inline font-mono text-xs font-bold text-neutral-900">{persona.label}</h3>
        </div>
      </div>
      {persona.model ? (
        <span className="w-fit rounded-sm bg-neutral-900/10 px-1.5 py-0.5 font-mono text-[0.625rem] text-neutral-700">
          {modelShortName(persona.model)}
        </span>
      ) : null}

      <p className="text-sm text-neutral-600">{persona.lens}</p>

      <div className="mt-auto flex flex-col gap-2" aria-hidden="true">
        <div className="h-2 w-full animate-pulse rounded-sm bg-neutral-900/10" />
        <div className="h-2 w-4/5 animate-pulse rounded-sm bg-neutral-900/10" />
        <div className="h-2 w-3/5 animate-pulse rounded-sm bg-neutral-900/10" />
      </div>

      <p className="font-mono text-[0.625rem] font-bold uppercase tracking-[0.2em] text-orange-700">
        Deliberating…
      </p>
    </article>
  )
}

/** Props for {@link PersonaBenchedCard}. */
interface PersonaBenchedCardProps {
  /** The persona whose model call failed, from the run-start roster. */
  persona: RunStartPersona
  /** Error constructor name from the `persona-error` event (never a message). */
  errorType: string
}

/**
 * A scout's slot when their model call failed (#241): the run proceeds with
 * the survivors and this report says so plainly — "DID NOT REPORT" is
 * stamped, never papered over.
 */
export function PersonaBenchedCard({ persona, errorType }: PersonaBenchedCardProps) {
  return (
    <article
      aria-label={`${persona.label} — did not report`}
      className="flex h-full min-h-64 flex-col gap-3 rounded-md border border-dashed border-neutral-900/30 bg-[#f5f0e4]/60 p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[0.625rem] font-bold uppercase tracking-[0.2em] text-neutral-600">
          Scouting report
        </span>
        <span className="-rotate-3 rounded border-2 border-red-800/60 px-1.5 py-0.5 font-mono text-[0.5625rem] font-bold uppercase tracking-[0.18em] text-red-800/90">
          Did not report
        </span>
      </div>
      <div className="flex gap-2 font-mono text-xs text-neutral-700">
        <span className="uppercase tracking-[0.12em] text-neutral-500">Scout</span>
        <h3 className="inline font-mono text-xs font-bold text-neutral-800">{persona.label}</h3>
      </div>
      {persona.model ? (
        <span className="w-fit rounded-sm bg-neutral-900/10 px-1.5 py-0.5 font-mono text-[0.625rem] text-neutral-600">
          {modelShortName(persona.model)}
        </span>
      ) : null}

      <p className="text-sm text-neutral-600">
        Did not report — the model call failed ({errorType}). The panel continued with the
        remaining voices; the synthesis is told this seat was empty.
      </p>
    </article>
  )
}
