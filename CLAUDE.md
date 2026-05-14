# Working style

## Bash commands

Prefer one discrete action per `Bash` tool call. Avoid chaining with `&&`, `;`, or `||` even when steps depend on each other — separate calls keep output readable, isolate errors to the failing step, and make retries straightforward. Pipes within a single pipeline (e.g. `grep foo | head`) are fine; they're one logical command.

If several commands are independent, issue them as parallel Bash tool calls in the same message rather than chaining them.

## Polling and waiting

Do **not** write `until <check>; do sleep N; done` shell loops. Use the in-harness `Monitor` tool when driving from the agent, or the `scripts/await-*.ps1` helpers when shelling out (e.g. inside `/ship-issue` or any wrapper script). Both are allowlisted and have real timeouts; ad-hoc `until` loops hang forever if the check disappears and bloat transcripts with one-off jq expressions.

- **`scripts/await-pr-checks.ps1`** — wait for a PR's status checks to reach terminal state. Use instead of `until gh pr view N --json statusCheckRollup ...`.
  `powershell -File scripts/await-pr-checks.ps1 -Pr 192 -Check Vercel -TimeoutSec 600`
- **`scripts/await-url.ps1`** — wait for an HTTP endpoint to respond. Use instead of `until curl -sf http://...`.
  `powershell -File scripts/await-url.ps1 -Url http://localhost:3000 -TimeoutSec 60`
- **`scripts/await-log-pattern.ps1`** — wait for a regex to appear in a file. Use instead of `until grep -q "Ready in" "<log>"`.
  `powershell -File scripts/await-log-pattern.ps1 -Path "<task.output>" -Pattern 'Ready in' -TimeoutSec 60`

All three exit 0 on success, 2 on timeout. Both `powershell -File` and `pwsh -File` are allowlisted — use whichever is on PATH (`powershell.exe` on Windows, `pwsh` on macOS/Linux or Windows with PowerShell 7+).

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
