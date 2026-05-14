<#
.SYNOPSIS
  Poll a URL until it returns a matching HTTP status, then exit.

.DESCRIPTION
  Replaces the `until curl -sf http://localhost:PORT/path; do sleep N; done`
  loops used to wait for the Next.js dev server (or any HTTP endpoint) to
  come up. Honours a real timeout so a never-listening port no longer hangs
  the session.

  Exit codes:
    0 — status code matched -StatusPattern
    2 — timeout elapsed
    1 — usage error

  Allowlisted in `.claude/settings.json` as
  `Bash(pwsh -File scripts/await-url.ps1 *)`.

.PARAMETER Url
  Full URL to probe (e.g. http://localhost:3000/training-facility).

.PARAMETER StatusPattern
  Regex the response status code must match to count as "ready". Default
  `^(200|3\d\d|404)$` — covers OK, redirects, and Next's 404 for routes
  that exist but have no data, which still proves the server is serving.

.PARAMETER TimeoutSec
  Hard upper bound. Default 60.

.PARAMETER PollSec
  Seconds between polls. Default 2.

.EXAMPLE
  pwsh -File scripts/await-url.ps1 -Url http://localhost:3000

.EXAMPLE
  pwsh -File scripts/await-url.ps1 -Url http://localhost:3009/training-facility -StatusPattern '^200$' -TimeoutSec 90
#>

param(
  [Parameter(Mandatory = $true)]
  [string]$Url,

  [string]$StatusPattern = '^(200|3\d\d|404)$',

  [ValidateRange(1, 600)]
  [int]$TimeoutSec = 60,

  [ValidateRange(1, 60)]
  [int]$PollSec = 2
)

$ErrorActionPreference = 'Stop'

$deadline = (Get-Date).AddSeconds($TimeoutSec)

while ($true) {
  $status = $null
  try {
    $resp = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    $status = [string][int]$resp.StatusCode
  } catch {
    # Windows PowerShell 5.1 throws [System.Net.WebException]; PowerShell 7+
    # throws [Microsoft.PowerShell.Commands.HttpResponseException]. Both
    # expose .Response.StatusCode, so duck-type instead of branching on type.
    $response = $null
    if ($_.Exception -and $_.Exception.PSObject.Properties.Name -contains 'Response') {
      $response = $_.Exception.Response
    }
    if ($response -and $response.PSObject.Properties.Name -contains 'StatusCode') {
      $status = [string][int]$response.StatusCode
    }
  }

  if ($status -and $status -match $StatusPattern) {
    Write-Output "ready: $Url -> $status"
    exit 0
  }

  if ((Get-Date) -gt $deadline) {
    $lastShown = if ($status) { $status } else { 'no response' }
    Write-Output "TIMEOUT: ${TimeoutSec}s elapsed waiting on $Url (last: ${lastShown})"
    exit 2
  }

  Start-Sleep -Seconds $PollSec
}
