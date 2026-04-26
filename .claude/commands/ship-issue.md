---
description: Ship a GitHub issue end-to-end — questions upfront if any design/implementation choices, then worktree → implement → PR → review loop runs autonomously, stop at "ready to merge" for your final spot-check.
---

# /ship-issue

Take the GitHub issue at `$ARGUMENTS` from open to PR-ready in one shot. Argument is an issue number (e.g. `52`) or URL — extract the number.

**Deliverable:** a PR sitting in "ready to merge" state with a test plan in the description. **You do not merge.** The user reviews and runs `gh pr merge` themselves.

**Prerequisite:** must run from the main repo, NOT from inside another worktree — Phase 2 calls `EnterWorktree` which fails if the session is already in one. If you're inside a worktree, `ExitWorktree` (action: keep or remove as appropriate) first, or ask the user.

## Phase 1 — Read the issue + upfront alignment

1. `gh issue view <number>` for title, body, labels, milestone, references.
2. If the body links a PRD section / doc, read that section before implementing.
3. Read enough of the codebase to know the blast radius — which files you'll touch, what conventions apply, whether anything in flight (open PRs, other worktrees) overlaps.
4. **Upfront question pass — always.** Surface the design and implementation decisions that would meaningfully shape the PR: visual/UX variants, scope boundaries, naming/structure choices, behavior tradeoffs, tests/no-tests, anything you'd revisit if you got it wrong. List them tersely with your recommendation for each, ask in one batch, and wait for the user's answers before Phase 2. If the issue is fully specified and there are genuinely no real choices to make, say "no open questions, proceeding" and continue — don't manufacture filler questions.

## Phase 2 — Worktree + implement

1. Pick a `<slug>` — 2–4 words from the issue title in kebab-case (e.g. `data-layer`, `trading-card`). Reuse this same slug for the worktree name and the remote branch in Phase 3.
2. `EnterWorktree` named `issue-<number>-<slug>`.
3. Implement against the issue's "Done when" criteria. Don't scope-creep. If a step fails (build error, test failure), fix and retry; if you can't, surface to the user.
4. Verify locally:
   - `npx tsc --noEmit` — must be clean.
   - `npx next build` — must compile.
5. Commit using a conventional message:
   ```
   <type>(<scope>): <one-line summary>

   <2–4 sentence why-not-what>

   Closes #<number>.

   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   ```

## Phase 3 — Push + open PR

No user pause in this phase. Once Vercel comes back green, flow directly into Phase 4.

1. **Verify the base is current.** `git fetch origin main` then check that the worktree branch sits on top of `origin/main`. If it diverges from a stale ref, rebase onto `origin/main` *before* the first push. If you've already pushed to a branch with a stale base, push the rebased commit to a *new* branch name — never force-push (memory rule).
2. Push to `feat/<number>-<slug>` (same `<slug>` as the worktree).
3. Open the PR with:
   - **Title:** `<type>(<scope>): <summary> (#<issue>)`
   - **Body:** summary, "## Test plan" markdown checklist of concrete things to click/verify, `Closes #<issue>.`
4. **Wait for Vercel.** Poll `gh pr view <pr> --json statusCheckRollup` every ~30s for up to 10 min total:
   - On `SUCCESS` for the Vercel context: continue immediately to Phase 4.
   - On `FAILURE` / `ERROR` / `CANCELED`: stop, surface the failure URL to the user. Do not enter the review loop until the build is fixed.
   - On 10-min timeout while still `PENDING`: stop and surface to the user.
5. **Extract the preview URL** from the Vercel bot's PR comment (not `statusCheckRollup.targetUrl`, which points at the dashboard). Hold onto it — Phase 5 includes it in the final hand-off message.

## Phase 4 — Review loop (/review-led, CodeRabbit best-effort)

`/review` is the primary signal. CodeRabbit may throttle — don't gate progress on it.

Loop until convergence, **max 3 iterations**:

1. Run the `/review` skill on the PR. Address actionable findings with a new commit on the same branch. Push.
2. Check for new CodeRabbit / Codex inline comments since your last commit (`gh pr view <pr> --json comments,reviews`). Address actionable ones in the same or next commit. Reply on each thread to note what changed.
3. **Convergence check** — stop when ALL of:
   - `/review` returned no new actionable findings on the latest commit.
   - CodeRabbit's check is `SUCCESS`, **or** CodeRabbit's check is still `PENDING`/missing more than 5 min after the latest push to the branch (treat as throttled) and `/review` is clean.
   - No reviewer is repeating a finding that was already addressed (a repeat = signal to stop and surface to the user, not ping-pong).
4. Otherwise, `ScheduleWakeup` ~270s and repeat from step 1.
5. **Hard cap:** if 3 full iterations haven't converged, stop and surface to the user — "I've made N rounds; here's what's still flagged. Need direction."

If a comment is unclear or you disagree with it, don't silently fix or ignore — stop the loop and ask the user.

## Phase 5 — Hand off (the only user-pause besides Phase 1)

This is the user's spot-check moment. Everything else is autonomous.

1. Post a final PR comment summarizing:
   - ✅ Status of `/review`, CodeRabbit, Vercel.
   - **Test plan** — concrete steps the user should run/click before merging.
   - The merge command: `gh pr merge <pr> --squash --delete-branch`.
2. Tell the user, in one short message:
   - PR URL (`https://github.com/.../pull/<pr>`)
   - Vercel preview URL (extracted in Phase 3 step 5 — the `*.vercel.app` link from the Vercel bot's PR comment, NOT the dashboard URL from `statusCheckRollup.targetUrl`)
   - One-line summary of what shipped
   - "Spot-check the preview against the test plan, then say 'merge' (or run the command yourself)."
3. Stop. **Do not merge.** Do not exit the worktree — the user may want one more change.

## Project-specific notes

- Single-action Bash calls (no `&&` chaining) — this repo's CLAUDE.md.
- JSDoc all exported types/properties/functions — this repo's CLAUDE.md.
- Default branch is `main`. Local `master` has a broken upstream — ignore it.
- PR-review fixes go on the same branch as new commits, not a separate PR.
