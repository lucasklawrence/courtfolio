<#
.SYNOPSIS
  Make a fresh git worktree usable: link node_modules, copy .env.local.

.DESCRIPTION
  `git worktree add` gives you the tracked files and nothing else, so a new
  worktree is missing the two untracked things this repo needs to run:

    1. `node_modules` — `vitest.config.ts` aliases `server-only` to
       `path.resolve(__dirname, 'node_modules/server-only/empty.js')`, an
       ABSOLUTE path inside the worktree. Node's own resolution would happily
       walk up to the main checkout, but that alias never does, so ~22 test
       files fail with "Cannot find module 'server-only'" until a local
       `node_modules` exists.

       Normally a directory junction to the main checkout's `node_modules` is
       enough, and costs no disk. But when the branch changes `package.json`
       or `package-lock.json`, sharing is wrong twice over: the suite would run
       against a tree that doesn't match the branch, and `npm install` here
       writes THROUGH the junction into the main checkout's `node_modules`,
       corrupting every other worktree and any session mid-test-run. Those
       branches get a real `npm ci` instead — slower, isolated, correct.

    2. `.env.local` — gitignored, so anything reading Supabase credentials
       (`npm run migrations:check`, `import-otbeat`, `staging:sync`) fails
       until it is copied across.

  Without this, the first thing a new worktree shows you is a wall of red
  tests, which is a good way to make people stop using worktrees. Run it once
  after entering a worktree.

  Safe to re-run. An existing junction, an existing real install, and an
  existing `.env.local` are all left alone — so for a normal branch a re-run is
  a no-op. On a dependency-changing branch it re-runs `npm ci` every time,
  which is slow but is the only way to stay honest about a lockfile that may
  have moved since the last run.

  Exit codes:
    0 — worktree ready (or already was)
    1 — not run from inside a worktree, or the main checkout has no
        node_modules to link against

.PARAMETER Force
  Replace an existing `.env.local` with the main checkout's copy. Off by
  default so a worktree pointed at a different project (e.g. staging) is not
  silently reset to production credentials.

.PARAMETER Link
  Junction `node_modules` even when the branch changes dependencies, and
  replace an existing real install with a junction. An escape hatch for when
  you know the dependency delta is irrelevant to what you're running and don't
  want to wait for `npm ci`. Understand what it shares before using it.

.PARAMETER Isolate
  Force a real, isolated `node_modules` even when nothing has changed yet.

  For the case the automatic detection cannot see: you are *about* to add a
  dependency. Both checks look at what already exists -- committed diff and
  working tree -- so on a branch where neither has happened, the script
  junctions, and the `npm install` that follows writes THROUGH the junction
  into the main checkout's install. Passing `-Isolate` up front skips that
  whole trap.

  If you only realise afterwards, re-running the script now works too: an
  uncommitted `package.json` edit is detected and triggers isolation (#404).

  Contradicts `-Link`; passing both is an error rather than a silent
  precedence rule.

.EXAMPLE
  powershell -File scripts/worktree-init.ps1

.NOTES
  REMOVING A WORKTREE THIS SCRIPT LINKED: use
  `scripts/worktree-remove.ps1 -Path <path>`, which unlinks the junction before
  deleting.

  Do NOT reach for `git worktree remove` directly, and do NOT use
  `Remove-Item -Recurse` on the junction. Both delete straight THROUGH the link
  into the main checkout's real node_modules, emptying it and breaking every
  other worktree pointing at it. (An earlier version of this note claimed
  `git worktree remove` was safe here. It is not — verified the hard way.)
#>
[CmdletBinding()]
param(
  [switch]$Force,
  [switch]$Link,
  [switch]$Isolate
)

$ErrorActionPreference = 'Stop'

# In a worktree, --git-common-dir points at the MAIN checkout's .git, while
# --git-dir points at .git/worktrees/<name>. Equal values mean we're in the
# main checkout, where node_modules is real and this script has no business
# running.
$commonDir = (git rev-parse --git-common-dir 2>$null)
$gitDir = (git rev-parse --git-dir 2>$null)
if (-not $commonDir) {
  Write-Error 'Not inside a git repository.'
  exit 1
}
if ($commonDir -eq $gitDir) {
  Write-Host 'Already in the main checkout - nothing to link. (Run this from a worktree.)'
  exit 1
}

$mainRoot = Split-Path -Parent (Resolve-Path $commonDir)
$worktreeRoot = (git rev-parse --show-toplevel)

$srcModules = Join-Path $mainRoot 'node_modules'
$dstModules = Join-Path $worktreeRoot 'node_modules'

# Does this branch change dependencies? A junction makes the worktree's
# node_modules IDENTICAL to the main checkout's, which is simply wrong for a
# branch that adds or removes packages: the suite would run against a tree that
# doesn't match package.json, passing on packages the branch deleted or failing
# on ones it added. And the repair -- `npm install` here -- writes THROUGH the
# junction into the main checkout's node_modules, corrupting every other
# worktree sharing it and any session mid-test-run. So dependency branches get
# a real, isolated install instead.
# Both git calls are checked rather than silenced. Swallowing an error here
# would evaluate to "no dependency changes" and fall through to the shared
# junction -- failing open into exactly the case this check exists to catch
# (CodeRabbit, #358). An unresolvable base is a question, not a default.
git rev-parse --verify --quiet 'origin/main' > $null 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Error 'Cannot resolve origin/main - run `git fetch origin main`, then re-run. (Needed to tell whether this branch changes dependencies.)'
  exit 1
}
$changedDepFiles = git diff --name-only 'origin/main...HEAD' -- package.json package-lock.json
if ($LASTEXITCODE -ne 0) {
  Write-Error 'git diff against origin/main failed - cannot determine whether this branch changes dependencies.'
  exit 1
}
$committedDepChange = [bool]$changedDepFiles

# Uncommitted dependency edits count too (#404). The committed check above only
# sees `origin/main...HEAD`, so it is blind for the whole window between
# editing package.json and committing it -- which is exactly when the risk is
# live, because that is when you reach for `npm install`. It also made
# CLAUDE.md's documented recovery ("re-run the bootstrap if you need to change
# dependencies in a worktree that's already linked") a silent no-op: the re-run
# saw no committed change and happily re-confirmed the junction.
$dirtyDepFiles = git status --porcelain -- package.json package-lock.json
if ($LASTEXITCODE -ne 0) {
  Write-Error 'git status on package.json failed - cannot determine whether this worktree has uncommitted dependency edits.'
  exit 1
}
$uncommittedDepChange = [bool]$dirtyDepFiles

$depsChanged = $committedDepChange -or $uncommittedDepChange

if ($Isolate -and $Link) {
  Write-Error '-Isolate and -Link are contradictory: one forces a real install, the other forces the shared junction. Pass at most one.'
  exit 1
}

if (($depsChanged -or $Isolate) -and -not $Link) {
  # Name the trigger: three different conditions land here, and "why is this
  # taking two minutes" is the first question when it fires unexpectedly.
  $reason =
    if ($Isolate) { '-Isolate requested' }
    elseif ($committedDepChange) { 'branch changes dependencies' }
    else { 'uncommitted dependency edits' }
  Write-Host "node_modules  $reason - installing in isolation"
  $existing = if (Test-Path $dstModules) { Get-Item $dstModules -Force } else { $null }
  if ($existing -and $existing.LinkType -eq 'Junction') {
    # Never Remove-Item -Recurse a junction: it deletes the TARGET.
    cmd /c rmdir "$dstModules" | Out-Null
  }
  # `ci` or `install`, depending on whether the lockfile can be trusted (#404).
  #
  # `npm ci` honours the lockfile exactly, which is right for a *committed*
  # dependency change: the branch carries a coherent package.json + lock pair.
  # But `ci` refuses outright when the two disagree, and mid-authoring they
  # always do -- you have just added a dependency to package.json and the lock
  # has not caught up. Running `ci` there fails with "package.json and
  # package-lock.json are not in sync", leaving the worktree with no
  # node_modules at all, which is a worse place than it started.
  #
  # So an uncommitted edit gets `install`, which updates the lock and is the
  # command you actually wanted. It is safe here specifically because the
  # junction has already been removed above -- that is the whole hazard this
  # branch exists to avoid.
  if ($uncommittedDepChange) {
    Write-Host 'node_modules  uncommitted package.json - using `npm install` so the lockfile updates'
    npm install --prefix "$worktreeRoot"
    $installCmd = 'npm install'
  }
  else {
    npm ci --prefix "$worktreeRoot"
    $installCmd = 'npm ci'
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Error "$installCmd failed - the worktree has no usable node_modules."
    exit 1
  }
}
elseif (-not (Test-Path $srcModules)) {
  Write-Error "Main checkout has no node_modules at $srcModules - run npm install there first."
  exit 1
}
else {
  $existing = if (Test-Path $dstModules) { Get-Item $dstModules -Force } else { $null }
  if ($existing -and $existing.LinkType -eq 'Junction') {
    Write-Host "node_modules  already linked"
  }
  elseif ($existing -and -not $Link) {
    # A real install already here (e.g. this branch used to change deps, or
    # -Link was never passed). Leave it: replacing a correct isolated tree with
    # a shared junction is a downgrade.
    Write-Host "node_modules  real install present - left alone"
  }
  else {
    if ($existing) {
      cmd /c rmdir /s /q "$dstModules" | Out-Null
    }
    New-Item -ItemType Junction -Path $dstModules -Target $srcModules | Out-Null
    Write-Host "node_modules  linked -> $srcModules"
  }
}

# --- .env.local ------------------------------------------------------------
$srcEnv = Join-Path $mainRoot '.env.local'
$dstEnv = Join-Path $worktreeRoot '.env.local'
if (-not (Test-Path $srcEnv)) {
  Write-Host ".env.local     not present in the main checkout - skipped"
}
elseif ((Test-Path $dstEnv) -and -not $Force) {
  Write-Host ".env.local     already present (pass -Force to overwrite)"
}
else {
  Copy-Item -Path $srcEnv -Destination $dstEnv -Force
  Write-Host ".env.local     copied from the main checkout"
}

# --- verify ----------------------------------------------------------------
# The specific file vitest's alias resolves to. If this is missing the junction
# exists but points somewhere useless, and the test suite would still fail.
$probe = Join-Path $dstModules 'server-only\empty.js'
if (Test-Path $probe) {
  Write-Host 'server-only    resolves - worktree ready'
  exit 0
}
Write-Error "Junction created but $probe is missing - is the main checkout's install complete?"
exit 1
