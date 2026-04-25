# Working style

## Bash commands

Prefer one discrete action per `Bash` tool call. Avoid chaining with `&&`, `;`, or `||` even when steps depend on each other — separate calls keep output readable, isolate errors to the failing step, and make retries straightforward. Pipes within a single pipeline (e.g. `grep foo | head`) are fine; they're one logical command.

If several commands are independent, issue them as parallel Bash tool calls in the same message rather than chaining them.
