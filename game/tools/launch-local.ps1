param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

function Find-NodeExe {
  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command -and $command.Source) {
    return $command.Source
  }

  $candidates = @(
    (Join-Path $env:ProgramFiles "nodejs\node.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "nodejs\node.exe")
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return $candidate
    }
  }

  return $null
}

function Test-ServerReady {
  param(
    [int]$Port
  )

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/" -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Test-PortInUse {
  param(
    [int]$Port
  )

  $client = New-Object System.Net.Sockets.TcpClient

  try {
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $connected = $async.AsyncWaitHandle.WaitOne(200)

    if (-not $connected) {
      return $false
    }

    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

$nodeExe = Find-NodeExe

if (-not $nodeExe) {
  Write-Host ""
  Write-Host "Node.js was not found."
  Write-Host "Install Node.js from https://nodejs.org/ and try again."
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

$portCandidates = @(8091, 8092, 8093, 8094, 8095)
$selectedPort = $null
$serverProc = $null

foreach ($port in $portCandidates) {
  if (Test-PortInUse -Port $port) {
    continue
  }

  $escapedRoot = $projectRoot.Replace("'", "''")
  $escapedNode = $nodeExe.Replace("'", "''")
  $serverCommand = "Set-Location -LiteralPath '$escapedRoot'; `$env:PORT='$port'; & '$escapedNode' 'tools/serve-static.mjs'"

  $serverProc = Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command", $serverCommand
  ) -WorkingDirectory $projectRoot -PassThru

  for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
    Start-Sleep -Milliseconds 300

    if (Test-ServerReady -Port $port) {
      $selectedPort = $port
      break
    }

    if ($serverProc.HasExited) {
      break
    }
  }

  if ($selectedPort) {
    break
  }
}

if (-not $selectedPort) {
  Write-Host ""
  Write-Host "Failed to start the local server."
  Write-Host "Try running this command manually:"
  Write-Host "  $nodeExe tools\serve-static.mjs"
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

$url = "http://127.0.0.1:$selectedPort/"

Write-Host ""
Write-Host "Robot Air Combat Boss Battle"
Write-Host "Server: $url"
Write-Host ""

if (-not $NoBrowser) {
  Start-Process $url | Out-Null
}

exit 0
