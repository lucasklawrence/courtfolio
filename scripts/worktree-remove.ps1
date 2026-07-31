<#
.SYNOPSIS
  Remove a worktree without destroying the main checkout's node_modules.

.DESCRIPTION
  `git worktree remove` deletes the worktree directory recursively, and it does
  NOT treat a directory junction as a link to step over — it deletes straight
  THROUGH `node_modules` into the main checkout's real installation, emptying
  it. `scripts/worktree-init.ps1` creates exactly such a junction, so the two
  scripts are a matched pair: whatever links must unlink before the delete.

  This was not theoretical. It happened here, to the main checkout, minutes
  after the note claiming `git worktree remove` "handles this correctly on its
  own" was written. It doesn't. Recovery is `npm ci` in the main checkout and a
  few wasted minutes, and it breaks every other worktree at the same time
  because they all point at the same target.

  So the order is not a thing to remember, it's a thing to run:

    1. Unlink `node_modules` if it is a junction (`cmd /c rmdir`, which removes
       the link only).
    2. `git worktree remove --force`.
    3. Verify the main checkout's `node_modules` is still populated, and say so
       loudly if it isn't — a silent empty install is the failure that costs an
       hour of confusing test errors later.

  A worktree with a *real* `node_modules` (a dependency-changing branch, see
  worktree-init) is left for git to delete normally; there is no link to follow.

  Exit codes:
    0 — worktree removed, main checkout verified intact
    1 — usage error, unknown worktree, or the main install ended up damaged

.PARAMETER Path
  Worktree to remove. Absolute, or relative to the CURRENT directory. Refused
  if it is the main checkout, the worktree this shell is standing in, or
  anything `git worktree list` doesn't know about.

.PARAMETER KeepBranch
  Leave the branch in place. By default the branch is deleted too, matching the
  usual post-merge cleanup.

.EXAMPLE
  powershell -File scripts/worktree-remove.ps1 -Path .claude/worktrees/issue-42-thing

.NOTES
  Run from the main checkout. Removing the worktree you are standing in leaves
  the shell in a deleted directory; the script refuses to do it.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Path,
  [switch]$KeepBranch
)

$ErrorActionPreference = 'Stop'

$commonDir = (git rev-parse --git-common-dir 2>$null)
if (-not $commonDir) {
  Write-Error 'Not inside a git repository.'
  exit 1
}
$mainRoot = Split-Path -Parent (Resolve-Path $commonDir)

# Resolve relative paths against the CURRENT directory, the way every other
# command does. Resolving them against the repo root instead made `-Path .`
# silently mean "the main checkout" — which slipped past the standing-in-it
# guard below and got as far as asking git to remove the main working tree. Git
# refused, but the script should never have asked.
if (-not (Test-Path $Path)) {
  Write-Error "No such directory: $Path"
  exit 1
}
$target = (Resolve-Path $Path).Path

# `git worktree list` includes the main working tree, so membership alone is not
# enough of a check — name it explicitly.
if ($target -eq $mainRoot) {
  Write-Error 'Refusing to remove the main checkout. Pass a worktree under .claude/worktrees/.'
  exit 1
}

$here = (git rev-parse --show-toplevel 2>$null)
if ($here -and ((Resolve-Path $here).Path -eq $target)) {
  Write-Error 'Refusing to remove the worktree this shell is standing in - run from elsewhere.'
  exit 1
}

# Only operate on something git actually knows about, so a typo can't delete an
# unrelated directory. Stale (prunable) registrations are skipped rather than
# resolved: git still lists a worktree whose directory was deleted by hand, and
# Resolve-Path on it throws under ErrorActionPreference = 'Stop', so one
# unrelated stale entry would otherwise block removing a perfectly good worktree
# (codex, #360).
$known = (git worktree list --porcelain) -match '^worktree\s+(.+)$' | ForEach-Object {
  $listed = $_ -replace '^worktree\s+', ''
  if (Test-Path $listed) { (Resolve-Path $listed).Path }
}
if ($known -notcontains $target) {
  Write-Error "Not a registered worktree: $target  (see: git worktree list)"
  exit 1
}

$branch = (git -C $target rev-parse --abbrev-ref HEAD 2>$null)

# --- 1. unlink node_modules ------------------------------------------------
$modules = Join-Path $target 'node_modules'
if (Test-Path $modules) {
  $item = Get-Item $modules -Force
  if ($item.LinkType -eq 'Junction') {
    # rmdir on a junction removes the link and leaves the target alone.
    cmd /c rmdir "$modules" | Out-Null
    # $ErrorActionPreference = 'Stop' does NOT make a native command's nonzero
    # exit terminating, so this has to be checked by hand. Without it a locked
    # or permission-denied junction would be reported as unlinked and we'd hand
    # git a live link to delete through - recreating the exact failure this
    # wrapper exists to prevent (codex, #360).
    if ($LASTEXITCODE -ne 0) {
      Write-Error "Could not unlink $modules (rmdir exit $LASTEXITCODE). Refusing to continue - git would delete through the junction into the main checkout's node_modules. Close anything holding it open and retry."
      exit 1
    }
    # Verify rather than trust the exit code: the whole point of this script is
    # that the link is gone before git touches the directory.
    if (Test-Path $modules) {
      Write-Error "$modules still exists after rmdir. Refusing to continue for the same reason."
      exit 1
    }
    Write-Host 'node_modules  junction unlinked (target preserved)'
  }
  else {
    Write-Host 'node_modules  real install - git will delete it normally'
  }
}

# --- 2. remove the worktree -------------------------------------------------
git worktree remove $target --force
if ($LASTEXITCODE -ne 0) {
  Write-Error "git worktree remove failed for $target"
  exit 1
}
Write-Host "worktree      removed  $target"

if (-not $KeepBranch -and $branch -and $branch -ne 'HEAD') {
  git branch -D $branch 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Host "branch        deleted  $branch" }
  else { Write-Host "branch        kept     $branch (not fully merged, or already gone)" }
}

# --- 3. verify we did not eat the main install ------------------------------
# The specific file vitest's `server-only` alias resolves to. Checking a real
# file rather than just the directory, because the failure mode leaves an EMPTY
# node_modules behind, which every `Test-Path node_modules` would call fine.
$probe = Join-Path $mainRoot 'node_modules\server-only\empty.js'
if (Test-Path $probe) {
  Write-Host 'main install  verified intact'
  exit 0
}
Write-Error @"
MAIN CHECKOUT'S node_modules IS DAMAGED.
The removal appears to have deleted through a junction. Repair with:
    npm ci --prefix "$mainRoot"
Other worktrees linked to it are broken until you do.
"@
exit 1
