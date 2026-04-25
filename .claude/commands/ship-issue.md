---
description: Ship a GitHub issue end-to-end — worktree, implement, PR, /review-led loop — and stop at "ready to merge" for you to spot-check and merge.
---

# /ship-issue

Take the GitHub issue at `$ARGUMENTS` from open to PR-ready in one shot. Argument is an issue number (e.g. `52`) or URL — extract the number.

**Deliverable:** a PR sitting in "ready to merge" state with a test plan in the description. **You do not merge.** The user reviews and runs `gh pr merge` themselves.

## Phase 1 — Read the issue

1. `gh issue view <number>` for title, body, labels, milestone, references.
2. If the body links a PRD section / doc, read that section before implementing.
3. If the spec is ambiguous, ask the user before continuing — do not guess.

## Phase 2 — Worktree + implement

1. `EnterWorktree` named `issue-<number>-<slug>` where `<slug>` is 2–4 words from the title in kebab-case.
2. Implement against the issue's "Done when" criteria. Don't scope-creep.
3. Verify locally:
   - `npx tsc --noEmit` — must be clean.
   - `npx next build` — must compile.
4. Commit using a conventional message:
   ```
   <type>(<scope>): <one-line summary>

   <2–4 sentence why-not-what>

   Closes #<number>.

   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   ```

## Phase 3 — Push + Vercel spot-check (always)

1. **Verify the base is current.** `git fetch origin main` then check that the worktree branch sits on top of `origin/main`. If it diverges from a stale ref, rebase onto `origin/main` *before* the first push. If you've already pushed to a branch with a stale base, push the rebased commit to a *new* branch name — never force-push (memory rule).
2. Push to `feat/<number>-<slug>`.
3. Open the PR with:
   - **Title:** `<type>(<scope>): <summary> (#<issue>)`
   - **Body:** summary, "## Test plan" markdown checklist of concrete things to click/verify, `Closes #<issue>.`
4. Poll `gh pr view <pr> --json statusCheckRollup` until Vercel reports SUCCESS. Capture the preview URL.
5. **Always pause.** Tell the user: PR URL, Vercel preview URL, one-line summary of what changed. Wait for their signal before Phase 4.

## Phase 4 — Review loop (/review-led, CodeRabbit best-effort)

`/review` is the primary signal. CodeRabbit may throttle — don't gate progress on it.

Loop until convergence:

1. Run the `/review` skill on the PR. Address actionable findings with a new commit on the same branch. Push.
2. Check for new CodeRabbit / Codex inline comments since your last commit (`gh api repos/<owner>/<repo>/pulls/<pr>/comments`). Address actionable ones in the same or next commit. Reply on each thread to note what changed.
3. **Convergence check** — stop when ALL of:
   - `/review` returned no new actionable findings on the latest commit.
   - CodeRabbit's check is SUCCESS *or* CodeRabbit hasn't posted within ~5 min and `/review` is clean.
   - No reviewer is repeating a finding that was already addressed (a repeat = signal to stop and surface to the user, not ping-pong).
4. Otherwise, `ScheduleWakeup` ~270s and repeat from step 1.

If a comment is unclear or you disagree with it, don't silently fix or ignore — stop the loop and ask the user.

## Phase 5 — Hand off

1. Post a final PR comment summarizing:
   - ✅ Status of `/review`, CodeRabbit, Vercel.
   - **Test plan** — concrete steps the user should run/click before merging.
   - The merge command: `gh pr merge <pr> --squash --delete-branch`.
2. Tell the user: "PR is ready at <url>. Spot-check the test plan, then say 'merge' (or run the command yourself)." Stop.
3. **Do not merge.** Do not exit the worktree — the user may want one more change.

## Project-specific notes

- Single-action Bash calls (no `&&` chaining) — this repo's CLAUDE.md.
- JSDoc all exported types/properties/functions — this repo's CLAUDE.md.
- Default branch is `main`. Local `master` has a broken upstream — ignore it.
- PR-review fixes go on the same branch as new commits, not a separate PR.
