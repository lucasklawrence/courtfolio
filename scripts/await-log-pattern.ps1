<#
.SYNOPSIS
  Poll a file until its contents match a regex, then exit.

.DESCRIPTION
  Replaces the `until grep -q "<pattern>" "<task-log>"; do sleep 1; done`
  loops used to wait for a background process to write a known-ready marker
  (commonly "Ready in" from `next dev`). Adds a real timeout.

  Exit codes:
    0 — pattern matched
    2 — timeout elapsed
    1 — usage error

  Allowlisted in `.claude/settings.json` as
  `Bash(pwsh -File scripts/await-log-pattern.ps1 *)`.

.PARAMETER Path
  Path to the file to watch. Need not exist yet — the script will keep
  polling until it shows up or the timeout elapses.

.PARAMETER Pattern
  Regex passed to PowerShell's -match operator. Use single quotes in the
  shell to avoid PowerShell variable interpolation.

.PARAMETER TimeoutSec
  Hard upper bound. Default 60.

.PARAMETER PollSec
  Seconds between polls. Default 1.

.EXAMPLE
  pwsh -File scripts/await-log-pattern.ps1 -Path "C:/tmp/task.output" -Pattern 'Ready in'

.EXAMPLE
  pwsh -File scripts/await-log-pattern.ps1 -Path "$env:TEMP/build.log" -Pattern 'compiled successfully' -TimeoutSec 180
#>

param(
  [Parameter(Mandatory = $true)]
  [string]$Path,

  [Parameter(Mandatory = $true)]
  [string]$Pattern,

  [ValidateRange(1, 1800)]
  [int]$TimeoutSec = 60,

  [ValidateRange(1, 60)]
  [int]$PollSec = 1
)

$ErrorActionPreference = 'Stop'

$deadline = (Get-Date).AddSeconds($TimeoutSec)

while ($true) {
  if (Test-Path -LiteralPath $Path) {
    try {
      $content = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
      if ($content -and ($content -match $Pattern)) {
        Write-Output "matched: $Pattern in $Path"
        exit 0
      }
    } catch {
      # Mid-write race — retry on next poll.
    }
  }

  if ((Get-Date) -gt $deadline) {
    $existed = if (Test-Path -LiteralPath $Path) { 'exists' } else { 'missing' }
    Write-Output "TIMEOUT: ${TimeoutSec}s elapsed waiting for /$Pattern/ in $Path ($existed)"
    exit 2
  }

  Start-Sleep -Seconds $PollSec
}
