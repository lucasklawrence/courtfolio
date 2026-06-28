/**
 * The "why this design" note. The flashiest version of this idea is agents
 * arguing over rounds — and the research says that's the *worst* version
 * (debate amplifies bias). Saying so, with a citation, is what makes the page
 * read as considered rather than gimmicky: the honesty is the signal.
 */
export function WhyNoDebate() {
  return (
    <aside className="rounded-2xl border border-white/10 bg-black/40 p-5">
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-orange-300/80">
        Why the panel doesn’t debate
      </span>
      <p className="mt-2 text-sm leading-relaxed text-neutral-300">
        The version that looks coolest — agents arguing over multiple rounds — is the version the
        research says is worst: naive multi-agent debate <em>amplifies</em> bias and majority
        pressure steamrolls the agent that was right. So each panelist judges independently, a
        fact-checker refutes any claim the code doesn’t support, and a meta-judge weighs the split
        last. The disagreement you see above is real, not staged.
      </p>
      <a
        href="https://github.com/lucasklawrence/courtfolio/issues/234"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block font-mono text-xs text-orange-400 underline underline-offset-2 hover:text-orange-300"
      >
        The design + research → #234
      </a>
    </aside>
  )
}
