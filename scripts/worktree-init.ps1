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
       `node_modules` exists. A directory junction to the main checkout's
       `node_modules` is enough, and costs no disk.

    2. `.env.local` — gitignored, so anything reading Supabase credentials
       (`npm run migrations:check`, `import-otbeat`, `staging:sync`) fails
       until it is copied across.

  Without this, the first thing a new worktree shows you is a wall of red
  tests, which is a good way to make people stop using worktrees. Run it once
  after entering a worktree.

  Idempotent: an existing junction and an existing `.env.local` are both left
  alone, so re-running is a no-op.

  Exit codes:
    0 — worktree ready (or already was)
    1 — not run from inside a worktree, or the main checkout has no
        node_modules to link against

.PARAMETER Force
  Replace an existing `.env.local` with the main checkout's copy. Off by
  default so a worktree pointed at a different project (e.g. staging) is not
  silently reset to production credentials.

.EXAMPLE
  powershell -File scripts/worktree-init.ps1

.NOTES
  REMOVING THE JUNCTION: use `cmd /c rmdir <path>`, never
  `Remove-Item -Recurse`. PowerShell's recursive delete follows the junction
  and deletes the *target* — i.e. the main checkout's real node_modules.
  `git worktree remove` handles this correctly on its own; this note is for
  when you clean up by hand.
#>
[CmdletBinding()]
param(
  [switch]$Force
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

if (-not (Test-Path $srcModules)) {
  Write-Error "Main checkout has no node_modules at $srcModules - run npm install there first."
  exit 1
}

# --- node_modules junction -------------------------------------------------
$existing = if (Test-Path $dstModules) { Get-Item $dstModules -Force } else { $null }
if ($existing -and $existing.LinkType -eq 'Junction') {
  Write-Host "node_modules  already linked"
}
else {
  if ($existing) {
    # A real directory here is almost always vitest's `.vite` cache, created by
    # running tests before this script. Safe to drop; it is regenerated.
    cmd /c rmdir /s /q "$dstModules" | Out-Null
  }
  New-Item -ItemType Junction -Path $dstModules -Target $srcModules | Out-Null
  Write-Host "node_modules  linked -> $srcModules"
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
