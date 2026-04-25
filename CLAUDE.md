# Working style

## Bash commands

Prefer one discrete action per `Bash` tool call. Avoid chaining with `&&`, `;`, or `||` even when steps depend on each other — separate calls keep output readable, isolate errors to the failing step, and make retries straightforward. Pipes within a single pipeline (e.g. `grep foo | head`) are fine; they're one logical command.

If several commands are independent, issue them as parallel Bash tool calls in the same message rather than chaining them.

## Throwaway screenshots

Write any temporary screenshots (audit runs, verification captures, mobile spot-checks, anything you take just to look at) to the `screenshots/` directory at the repo root. Its contents are gitignored. Don't drop screenshots at the repo root — they'll show up as untracked clutter in `git status` and complicate every future stage.
