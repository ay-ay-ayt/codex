param(
  [string]$Page,
  [string]$Scenario,
  [switch]$DebugAnchors,
  [switch]$InteractiveWindow,
  [ValidateSet("none", "shoot", "jet", "hover", "lock")]
  [string]$ButtonProbe = "none",
  [switch]$ForceTouchControls,
  [ValidateSet("edge", "chrome")]
  [string]$Browser = "chrome",
  [int]$DelayMs = 8500,
  [int]$PostReadyDelayMs = 1800,
  [int]$CaptureCount = 1,
  [int]$CaptureIntervalMs = 350,
  [string]$CaptureTag,
  [string]$OutputPath,
  [switch]$KeepWindow
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

if (-not $CaptureTag) {
  $CaptureTag = "verify-$([DateTime]::Now.ToString('yyyyMMdd-HHmmss'))-$([guid]::NewGuid().ToString('N').Substring(0, 6))"
}

if ($ButtonProbe -ne "none") {
  $ForceTouchControls = $true
}

$useInteractiveWindow = $InteractiveWindow -or $KeepWindow
$useBackgroundCapture = -not $useInteractiveWindow

$multiFrameScenarioDefaults = @{
  "rear-jets-hover" = @{ Count = 4; IntervalMs = 500 }
  "rear-jets-jet" = @{ Count = 4; IntervalMs = 500 }
  "ground-walk" = @{ Count = 6; IntervalMs = 140 }
  "ground-run" = @{ Count = 6; IntervalMs = 140 }
  "ground-turn" = @{ Count = 6; IntervalMs = 140 }
  "left-barrel-fire" = @{ Count = 4; IntervalMs = 160 }
  "right-barrel-fire" = @{ Count = 4; IntervalMs = 160 }
  "left-barrel-fire-moving" = @{ Count = 4; IntervalMs = 160 }
  "right-barrel-fire-moving" = @{ Count = 4; IntervalMs = 160 }
}

if ($Scenario -and $CaptureCount -eq 1 -and $multiFrameScenarioDefaults.ContainsKey($Scenario)) {
  $CaptureCount = $multiFrameScenarioDefaults[$Scenario].Count
  $CaptureIntervalMs = $multiFrameScenarioDefaults[$Scenario].IntervalMs
}

function Find-VerificationWindow {
  param(
    [string]$ExpectedTitleFragment,
    [int]$PreferredProcessId,
    [int]$TimeoutMs
  )

  if (-not $ExpectedTitleFragment) {
    Start-Sleep -Milliseconds $TimeoutMs
    return $null
  }

  $deadline = [DateTime]::UtcNow.AddMilliseconds([Math]::Max(250, $TimeoutMs))
  $preferredWindow = $null

  while ([DateTime]::UtcNow -lt $deadline) {
    $candidates = Get-Process -ErrorAction SilentlyContinue | Where-Object {
      $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like "*$ExpectedTitleFragment*"
    }

    foreach ($candidate in $candidates) {
      if ($PreferredProcessId -and $candidate.Id -eq $PreferredProcessId) {
        return $candidate
      }

      if (-not $preferredWindow) {
        $preferredWindow = $candidate
      }
    }

    if ($preferredWindow) {
      return $preferredWindow
    }

    Start-Sleep -Milliseconds 250
  }

  return $null
}

function Test-CaptureLooksDark {
  param(
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return $true
  }

  try {
    $inspectJson = & powershell.exe -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "inspect-capture.ps1") -Path $Path
    $inspect = $inspectJson | ConvertFrom-Json
    return ($inspect.averageLuma -lt 0.2 -and $inspect.darkPixelRatio -gt 0.75)
  } catch {
    return $false
  }
}

function Get-ResolvedOutputPath {
  param(
    [string]$BaseOutput,
    [int]$Index,
    [int]$Count
  )

  if ($Count -le 1) {
    return $BaseOutput
  }

  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($BaseOutput)
  $extension = [System.IO.Path]::GetExtension($BaseOutput)
  $parent = Split-Path -Parent $BaseOutput
  return (Join-Path $parent ("{0}-{1:D2}{2}" -f $baseName, ($Index + 1), $extension))
}

$launchParams = @{
  PassThru = $true
  DedicatedWindow = $true
  Browser = $Browser
  ButtonProbe = $ButtonProbe
}

if ($Page) {
  $launchParams.Page = $Page
}

if ($Scenario) {
  $launchParams.Scenario = $Scenario
}

if ($CaptureTag) {
  $launchParams.CaptureTag = $CaptureTag
}

if ($DebugAnchors) {
  $launchParams.DebugAnchors = $true
}

if ($ForceTouchControls) {
  $launchParams.ForceTouchControls = $true
}

$launchJson = & (Join-Path $PSScriptRoot "launch-local.ps1") @launchParams | Select-Object -Last 1
$launchInfo = $launchJson | ConvertFrom-Json

if (-not $launchInfo) {
  throw "Failed to start verification session."
}

$captureDir = Join-Path $projectRoot "tmp\captures"
New-Item -ItemType Directory -Path $captureDir -Force | Out-Null

$baseOutputPath = $OutputPath

if (-not $baseOutputPath) {
  $slugParts = @()

  if ($Scenario) {
    $slugParts += $Scenario
  }

  if ($ButtonProbe -ne "none") {
    $slugParts += "button-$ButtonProbe"
  }

  if ($slugParts.Count -eq 0) {
    $slugParts += "verification"
  }

  $baseOutputPath = Join-Path $captureDir "$(($slugParts -join '-') + '-' + $CaptureTag).png"
}

$resolvedBaseOutput = [System.IO.Path]::GetFullPath($baseOutputPath)
$capturePaths = @()

$windowProcess = $null

try {
  $windowProcess = Find-VerificationWindow `
    -ExpectedTitleFragment "3D Robot Air Combat Boss Battle" `
    -PreferredProcessId $launchInfo.browserProcessId `
    -TimeoutMs ([Math]::Min($DelayMs, 2500))

  $windowProcess = Find-VerificationWindow `
    -ExpectedTitleFragment "ready-capture=$CaptureTag" `
    -PreferredProcessId $launchInfo.browserProcessId `
    -TimeoutMs $DelayMs

  if (-not $windowProcess) {
    $windowProcess = Find-VerificationWindow `
      -ExpectedTitleFragment "3D Robot Air Combat Boss Battle" `
      -PreferredProcessId $launchInfo.browserProcessId `
      -TimeoutMs ([Math]::Max(2500, [int]($DelayMs * 0.45)))
  }

  if (-not $windowProcess) {
    $windowProcess = Find-VerificationWindow `
      -ExpectedTitleFragment "3D繝ｭ繝懊ャ繝育ｩｺ荳ｭ繝懊せ謌ｦ" `
      -PreferredProcessId $launchInfo.browserProcessId `
      -TimeoutMs 2500
  }

  if (-not $windowProcess) {
    throw "Verification window did not become ready for capture tag '$CaptureTag'."
  }

  $lastWindowHandle = if ($windowProcess.MainWindowHandle -ne 0) {
    [Int64]$windowProcess.MainWindowHandle
  } else {
    0
  }

  Start-Sleep -Milliseconds 250
  Start-Sleep -Milliseconds ([Math]::Max(0, $PostReadyDelayMs))

  for ($index = 0; $index -lt [Math]::Max(1, $CaptureCount); $index += 1) {
    $resolvedOutput = Get-ResolvedOutputPath -BaseOutput $resolvedBaseOutput -Index $index -Count $CaptureCount
    $captureAccepted = $false

    for ($captureAttempt = 0; $captureAttempt -lt 3 -and -not $captureAccepted; $captureAttempt += 1) {
      $windowProcess = Find-VerificationWindow `
        -ExpectedTitleFragment "ready-capture=$CaptureTag" `
        -PreferredProcessId $launchInfo.browserProcessId `
        -TimeoutMs 1200

      if (-not $windowProcess) {
        $windowProcess = Find-VerificationWindow `
          -ExpectedTitleFragment "3D Robot Air Combat Boss Battle" `
          -PreferredProcessId $launchInfo.browserProcessId `
          -TimeoutMs 1200
      }

      if ($windowProcess -and $windowProcess.MainWindowHandle -ne 0) {
        $lastWindowHandle = [Int64]$windowProcess.MainWindowHandle
      }

      $captureArgs = @(
        "-ExecutionPolicy", "Bypass",
        "-File", (Join-Path $PSScriptRoot "capture-game-window.ps1"),
        "-OutputPath", $resolvedOutput
      )

      if ($lastWindowHandle -ne 0) {
        $captureArgs += @("-WindowHandle", [string]$lastWindowHandle)
      } else {
        $captureArgs += @("-WindowTitle", "ready-capture=$CaptureTag")
      }

      if ($useBackgroundCapture) {
        $captureArgs += "-BackgroundCapture"
      } else {
        $captureArgs += @("-DelayMs", "220", "-MaximizeWindow")
      }

      powershell.exe @captureArgs | Out-Null

      if (-not (Test-CaptureLooksDark -Path $resolvedOutput)) {
        $captureAccepted = $true
        break
      }

      Remove-Item -LiteralPath $resolvedOutput -ErrorAction SilentlyContinue
      Start-Sleep -Milliseconds (400 + $captureAttempt * 220)
    }

    if (-not $captureAccepted) {
      throw "Verification capture remained too dark after retries: $resolvedOutput"
    }

    $capturePaths += $resolvedOutput

    if ($index -lt ($CaptureCount - 1)) {
      Start-Sleep -Milliseconds $CaptureIntervalMs
    }
  }

  $capturePaths | Write-Output
} finally {
  if (-not $KeepWindow) {
    if ($windowProcess) {
      Stop-Process -Id $windowProcess.Id -ErrorAction SilentlyContinue
    }

    Get-Process -ErrorAction SilentlyContinue | Where-Object {
      $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like "*ready-capture=$CaptureTag*"
    } | ForEach-Object {
      Stop-Process -Id $_.Id -ErrorAction SilentlyContinue
    }
  }
}
