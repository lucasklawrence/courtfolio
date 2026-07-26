# Working style

## Work in a worktree, not the shared checkout

**If you are going to commit, work in a git worktree branched off `origin/main`.**
Several agent sessions run against this repo at once, and they all share the main
checkout's single HEAD. When one switches branches, the other's next commit lands
on the wrong branch — silently, with nothing in `git status` to warn you.

```
git worktree add .claude/worktrees/<slug> -b <branch> origin/main
```

then `EnterWorktree({ path: "<absolute path>" })`, then **`powershell -File
scripts/worktree-init.ps1`** — a bare worktree has no `node_modules` and no
`.env.local`, so without it ~22 test files fail on `server-only` and every
Supabase script fails on missing env. See `scripts/README.md`.

**Never run `npm install` in a worktree whose `node_modules` is a junction** —
it writes through the link into the main checkout's install and every other
worktree sharing it. The bootstrap avoids this by giving dependency-changing
branches a real isolated `npm ci` instead of a junction; if you need to change
dependencies in a worktree that's already linked, re-run the bootstrap.

Prefer `git worktree add` + `EnterWorktree({ path })` over
`EnterWorktree({ name })`: the latter has crashed here mid-create, leaving an
empty phantom directory that the session still switches into, after which
`git -C` silently resolves to the main repo. If a `name`-created worktree is
missing from `git worktree list`, that's what happened.

**You don't need one for** read-only investigation, answering questions, the
`log-workout` / `log-weight` skills (they write to Supabase via MCP and touch no
git), or migrations and data work that produce no commit.

Before every commit, confirm you're where you think you are — `git branch
--show-current`. Finding the main checkout on someone else's branch is the
signal that another session is live; don't switch it back, use a worktree.

After merging, clean up with `git worktree remove <path> --force`. If you remove
the `node_modules` junction by hand first, use `cmd /c rmdir`, **never**
`Remove-Item -Recurse` — the latter follows the junction and deletes the main
checkout's real `node_modules`.

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

## Database migrations

Every schema change is a committed `.sql` file in `supabase/migrations/` **and** a
recorded entry in the migration ledger. Both, always — the two drift apart
silently otherwise, and nothing in the app surfaces it.

The order matters:

1. **Write the file first**, named `<version>_<name>.sql`. The `<name>` must match
   the name you apply it under — the filename timestamp and the applied version
   are unrelated (files use a synthetic stamp; Supabase records the moment it
   actually ran), so the *name* is the only key tying the two sides together.
2. **Apply it with `apply_migration`** (the Supabase MCP tool) or the CLI, which
   records it in the ledger. Never run schema DDL through `execute_sql` or a raw
   query — that changes the database without recording anything, leaving a table
   the repo can't rebuild and the ledger doesn't know about.
3. **Commit the file.** A migration applied from an uncommitted file is drift the
   moment the session ends.

Write DDL idempotently — `create table if not exists`, `add column if not exists`,
`create policy` wrapped in a `do $$ ... exception when duplicate_object $$` block.
Re-applying on a fresh project or a branch reset should be a safe no-op. Guard
backfill `update`s with a `where <col> is null` so they never re-stamp a row.

**Backfills race deploys.** A migration that backfills a column derived by the
ingest path can be overtaken by a pull still running the previous code — that is
exactly how three OTF sessions kept a null `class_type` for 20 days (#334). When
a migration and a code change have to agree, make the ingest path self-heal the
null rather than assuming the backfill caught everything.

`npm run migrations:check` compares the two sides and fails on either kind of
gap: committed-but-unapplied, or applied-with-no-file. Run it after applying
anything. CI runs it with `--allow-untracked` on PRs touching
`supabase/migrations/`, so only committed-but-unapplied blocks a merge —
applied-with-no-file is usually just a sibling PR that hasn't landed yet, so it's
reported rather than enforced. The strict local run is what catches genuine
untracked drift.

## Two Supabase projects

| | ref | Holds |
|---|---|---|
| **production** | `ryxbnvhxxkrmsrmocume` | The real data. Source of truth. |
| **staging** | `tztrsfefesacnbreerhp` | A point-in-time copy, for preview deploys. |

**Everything that writes, writes to production.** The OTbeat cron, the
`log-workout` and `log-weight` skills (both hardcode the production ref), and the
Apple Health import. Nothing dual-writes. So:

- **Never read staging to answer a question about the data.** "How many classes
  in July", "what did I lift yesterday" — always production. Staging is stale by
  design and looks convincingly current, which is the trap.
- **Apply every migration to both.** `apply_migration` takes a `project_id`, so
  one session can do both; run `migrations:check` against each afterwards
  (point `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` at whichever you're checking).
  Production usually runs *ahead* of `main`, because a feature branch's migration
  is applied before its PR merges — that's expected, not drift.
- **Refresh staging with `npm run staging:sync`**, or the weekly
  `staging-sync` workflow. Upsert-based: production edits propagate,
  staging-only rows survive, deletions do **not** propagate.

Staging is also the place to rehearse a destructive migration — a `drop`, a type
change, a `not null` backfill — before running it anywhere near production.

## Throwaway screenshots

Write any temporary screenshots (audit runs, verification captures, mobile spot-checks, anything you take just to look at) to the `screenshots/` directory at the repo root. Its contents are gitignored. Don't drop screenshots at the repo root — they'll show up as untracked clutter in `git status` and complicate every future stage.
