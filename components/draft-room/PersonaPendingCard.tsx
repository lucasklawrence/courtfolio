import type { RunStartPersona } from '@/lib/draft-room/protocol'

/** Props for {@link PersonaPendingCard}. */
interface PersonaPendingCardProps {
  /** The persona this slot is waiting on, from the run-start roster. */
  persona: RunStartPersona
}

/** The model chip's display text: strip the gateway vendor prefix (`anthropic/claude-haiku-4.5` → `claude-haiku-4.5`). */
function modelShortName(model: string): string {
  return model.split('/').pop() ?? model
}

/**
 * A persona's skeleton card while its model call is in flight (#241). The
 * model chip is the honesty detail: three different vendors visibly
 * deliberating at genuinely different speeds *is* the independence proof.
 * CSS pulse only — consistent with the repo's CSS-first animation idiom.
 */
export function PersonaPendingCard({ persona }: PersonaPendingCardProps) {
  return (
    <article
      aria-label={`${persona.label} — deliberating`}
      className="flex h-full min-h-64 flex-col gap-4 rounded-2xl border border-white/10 bg-neutral-800/60 p-5 shadow-md"
    >
      <header className="flex flex-col gap-2">
        <h3 className="font-sans text-lg font-bold text-white">{persona.label}</h3>
        <span className="w-fit rounded-full bg-white/5 px-2 py-0.5 font-mono text-[0.625rem] text-neutral-400">
          {modelShortName(persona.model)}
        </span>
      </header>

      <p className="text-sm text-neutral-400">{persona.lens}</p>

      <div className="mt-auto flex flex-col gap-2" aria-hidden="true">
        <div className="h-2 w-full animate-pulse rounded bg-white/10" />
        <div className="h-2 w-4/5 animate-pulse rounded bg-white/10" />
        <div className="h-2 w-3/5 animate-pulse rounded bg-white/10" />
      </div>

      <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-orange-300/80">
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
 * A persona's card when its model call failed (#241): the run proceeds with
 * the survivors and this slot says so plainly — a benched panelist is shown,
 * never papered over.
 */
export function PersonaBenchedCard({ persona, errorType }: PersonaBenchedCardProps) {
  return (
    <article
      aria-label={`${persona.label} — did not report`}
      className="flex h-full min-h-64 flex-col gap-4 rounded-2xl border border-dashed border-white/10 bg-neutral-900/60 p-5"
    >
      <header className="flex flex-col gap-2">
        <h3 className="font-sans text-lg font-bold text-neutral-400">{persona.label}</h3>
        <span className="w-fit rounded-full bg-white/5 px-2 py-0.5 font-mono text-[0.625rem] text-neutral-500">
          {modelShortName(persona.model)}
        </span>
      </header>

      <p className="text-sm text-neutral-500">
        Did not report — the model call failed ({errorType}). The panel continued with the
        remaining voices; the synthesis is told this seat was empty.
      </p>
    </article>
  )
}
