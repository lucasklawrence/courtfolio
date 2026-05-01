<#
.SYNOPSIS
  Free a local TCP port by killing whichever process is listening on it.

.DESCRIPTION
  Wraps the recurring "the dev server didn't shut down cleanly, port still
  bound" cleanup that comes up during /ship-issue flows. Resolves the
  owning PID via Get-NetTCPConnection and stops just that process. Bounded
  to listeners on the supplied port — does not touch other processes.

  Allowlisted in `.claude/settings.json` as a narrow replacement for the
  broader `PowerShell(Stop-Process*)` pattern that CodeRabbit flagged.

.PARAMETER Port
  Local TCP port number whose listener should be terminated.

.EXAMPLE
  pwsh -File scripts/free-port.ps1 3010
#>

param(
  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 65535)]
  [int]$Port
)

$ErrorActionPreference = 'Stop'

$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listeners) {
  Write-Output "No listener on port $Port."
  exit 0
}

$processIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($processId in $processIds) {
  try {
    Stop-Process -Id $processId -Force -ErrorAction Stop
    Write-Output "killed pid $processId on port $Port"
  } catch {
    Write-Output "skip pid $processId on port $Port ($($_.Exception.Message))"
  }
}
