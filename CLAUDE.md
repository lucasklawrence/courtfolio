# Working style

## Bash commands

Prefer one discrete action per `Bash` tool call. Avoid chaining with `&&`, `;`, or `||` even when steps depend on each other — separate calls keep output readable, isolate errors to the failing step, and make retries straightforward. Pipes within a single pipeline (e.g. `grep foo | head`) are fine; they're one logical command.

If several commands are independent, issue them as parallel Bash tool calls in the same message rather than chaining them.

## TypeScript documentation

Document every exported type, interface, function, and non-trivial constant with a JSDoc comment. Document every property on an exported interface or type. The goal is that `Cmd/Ctrl+hover` in an editor surfaces what the symbol is and how to use it without jumping to the source.

What to write:
- **Types and interfaces:** one-line summary of what the shape represents. If it mirrors an external contract (on-disk JSON, API payload, PRD section), link to it.
- **Properties:** units, semantics, default behavior when omitted, anything not obvious from the name. `bodyweight_lbs?: number` — say it's pounds, that lower is better for a derived ratio, etc.
- **Functions:** one-line summary, then `@param` for non-obvious params and `@throws` for documented failure modes. Skip `@returns` when the return type is self-explanatory.

When to skip:
- Local variables, internal helpers whose name already says it all, and one-line inferred types. Don't restate what TypeScript already conveys (`/** A string. */` on a `string` field is noise).
- Don't reference the current task or fix in a doc comment — that belongs in the commit message.

## Throwaway screenshots

Write any temporary screenshots (audit runs, verification captures, mobile spot-checks, anything you take just to look at) to the `screenshots/` directory at the repo root. Its contents are gitignored. Don't drop screenshots at the repo root — they'll show up as untracked clutter in `git status` and complicate every future stage.
