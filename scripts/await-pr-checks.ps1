<#
.SYNOPSIS
  Poll a GitHub PR's status checks until they reach a terminal state, then exit.

.DESCRIPTION
  Replaces the `until gh pr view <N> ...; do sleep N; done` shell loops that
  accumulated across /ship-issue runs. Centralises the jq predicate so the
  per-call variation (Vercel-only vs. e2e vs. all-green vs. terminal) collapses
  into one `-Check` parameter, and adds a real timeout so a vanished check no
  longer hangs the session forever.

  Terminal states cover every GitHub CheckRunState that won't change again:
  SUCCESS, FAILURE, ERROR, NEUTRAL, SKIPPED, STALE, STARTUP_FAILURE, TIMED_OUT,
  ACTION_REQUIRED, CANCELLED/CANCELED, plus COMPLETED for a CheckRun that has
  finished with no explicit conclusion. Pending states are PENDING,
  IN_PROGRESS, QUEUED, REQUESTED, WAITING. The script polls every -PollSec
  seconds until every requested check is terminal, then prints a one-line
  summary per check on stdout.

  Exit codes:
    0 — every requested check is terminal (NOT necessarily SUCCESS — caller
        inspects the printed summary or re-queries `gh pr view`)
    2 — timeout elapsed before all requested checks reached terminal state
    1 — usage error (e.g. PR not found, unknown -Check value)

  Allowlisted in `.claude/settings.json` as
  `Bash(pwsh -File scripts/await-pr-checks.ps1 *)`.

.PARAMETER Pr
  Pull-request number on the current repo's default remote.

.PARAMETER Check
  Which check(s) to wait on:
    - all        wait until every check in the rollup is terminal (default)
    - Vercel     wait only on the Vercel preview deploy
    - e2e        wait only on the Playwright e2e workflow
    - unit       wait only on the vitest Unit tests workflow
    - CodeRabbit wait only on the CodeRabbit review status context

.PARAMETER TimeoutSec
  Hard upper bound in seconds. Default 600 (10 min) — enough for a cold
  Vercel build + e2e run; bump for slower workflows.

.PARAMETER PollSec
  Seconds between polls. Default 15.

.EXAMPLE
  pwsh -File scripts/await-pr-checks.ps1 -Pr 192 -Check Vercel

.EXAMPLE
  pwsh -File scripts/await-pr-checks.ps1 -Pr 192 -Check all -TimeoutSec 900
#>

param(
  [Parameter(Mandatory = $true)]
  [int]$Pr,

  [ValidateSet('all', 'Vercel', 'e2e', 'unit', 'CodeRabbit')]
  [string]$Check = 'all',

  [ValidateRange(10, 3600)]
  [int]$TimeoutSec = 600,

  [ValidateRange(1, 120)]
  [int]$PollSec = 15
)

$ErrorActionPreference = 'Stop'

$terminal = @(
  'SUCCESS', 'FAILURE', 'ERROR',
  'NEUTRAL', 'SKIPPED', 'STALE', 'STARTUP_FAILURE', 'TIMED_OUT', 'ACTION_REQUIRED',
  'CANCELLED', 'CANCELED',
  'COMPLETED'
)

function Get-Rollup {
  param([int]$PrNumber)
  # Don't redirect gh's stderr — in Windows PowerShell 5.1, redirecting a
  # native command's stderr wraps each line in a NativeCommandError and trips
  # `$ErrorActionPreference = 'Stop'` even on a clean exit. Branch on
  # $LASTEXITCODE instead.
  $raw = & gh pr view $PrNumber --json statusCheckRollup
  if ($LASTEXITCODE -ne 0 -or -not $raw) { return $null }
  return ($raw | ConvertFrom-Json).statusCheckRollup
}

function Get-CheckName {
  param($Entry)
  if ($Entry.PSObject.Properties.Name -contains 'context' -and $Entry.context) { return $Entry.context }
  if ($Entry.PSObject.Properties.Name -contains 'name'    -and $Entry.name)    { return $Entry.name }
  return '<unknown>'
}

function Get-CheckState {
  param($Entry)
  if ($Entry.PSObject.Properties.Name -contains 'state'      -and $Entry.state)      { return $Entry.state }
  if ($Entry.PSObject.Properties.Name -contains 'conclusion' -and $Entry.conclusion) { return $Entry.conclusion }
  # No conclusion but the check is COMPLETED — neutral/skipped run. Surface
  # it as terminal but don't lie about success.
  if ($Entry.PSObject.Properties.Name -contains 'status'     -and $Entry.status -eq 'COMPLETED') { return 'COMPLETED' }
  return 'PENDING'
}

function Select-RelevantChecks {
  param($Rollup, [string]$Filter)
  if ($Filter -eq 'all') { return $Rollup }
  return $Rollup | Where-Object {
    $n = Get-CheckName $_
    $n -eq $Filter
  }
}

$deadline = (Get-Date).AddSeconds($TimeoutSec)

while ($true) {
  $rollup = Get-Rollup -PrNumber $Pr
  if ($null -eq $rollup) {
    Write-Output "PR #$Pr not found or gh failed."
    exit 1
  }

  $relevant = Select-RelevantChecks -Rollup $rollup -Filter $Check
  if (-not $relevant) {
    if ((Get-Date) -gt $deadline) {
      if ($Check -eq 'all') {
        Write-Output "TIMEOUT: PR #$Pr has no status checks after ${TimeoutSec}s."
      } else {
        Write-Output "TIMEOUT: no check named '$Check' on PR #$Pr after ${TimeoutSec}s."
      }
      exit 2
    }
    Start-Sleep -Seconds $PollSec
    continue
  }

  $pending = @($relevant | Where-Object { (Get-CheckState $_) -notin $terminal })
  if ($pending.Count -eq 0) {
    foreach ($entry in $relevant) {
      $name  = Get-CheckName  $entry
      $state = Get-CheckState $entry
      Write-Output "${name}: ${state}"
    }
    exit 0
  }

  if ((Get-Date) -gt $deadline) {
    Write-Output "TIMEOUT: ${TimeoutSec}s elapsed; still pending:"
    foreach ($entry in $pending) {
      $name  = Get-CheckName  $entry
      $state = Get-CheckState $entry
      Write-Output "  ${name}: ${state}"
    }
    exit 2
  }

  Start-Sleep -Seconds $PollSec
}
