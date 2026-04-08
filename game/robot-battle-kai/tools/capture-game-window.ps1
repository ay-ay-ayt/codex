param(
  [string]$WindowTitle = "3D Robot Air Combat Boss Battle",
  [Int64]$WindowHandle,
  [int]$ProcessId,
  [string]$OutputPath,
  [int]$DelayMs = 450,
  [string]$Url,
  [ValidateSet("edge", "chrome")]
  [string]$Browser = "chrome",
  [switch]$MaximizeWindow,
  [int]$WindowX = 20,
  [int]$WindowY = 20,
  [int]$WindowWidth = 1280,
  [int]$WindowHeight = 960
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

if (-not $OutputPath) {
  $captureDir = Join-Path $projectRoot "tmp\captures"
  New-Item -ItemType Directory -Path $captureDir -Force | Out-Null
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutputPath = Join-Path $captureDir "$timestamp.png"
} else {
  $captureParent = Split-Path -Parent $OutputPath

  if ($captureParent) {
    New-Item -ItemType Directory -Path $captureParent -Force | Out-Null
  }
}

$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class WindowCaptureNative {
    public const int SW_RESTORE = 9;
    public const int SW_MAXIMIZE = 3;

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool MoveWindow(IntPtr hWnd, int x, int y, int width, int height, bool repaint);
}
"@

function Find-BrowserExe {
  param(
    [string]$Preferred
  )

  $candidateTable = @{
    edge = @(
      "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
      "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    )
    chrome = @(
      "C:\Program Files\Google\Chrome\Application\chrome.exe",
      "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    )
  }

  foreach ($candidate in $candidateTable[$Preferred]) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  return $null
}

$windowProcess = $null
$resolvedWindowHandle = [IntPtr]::Zero

if ($WindowHandle) {
  $resolvedWindowHandle = [IntPtr]::new($WindowHandle)
} elseif ($ProcessId) {
  $candidateProcess = Get-Process -Id $ProcessId -ErrorAction Stop

  if ($candidateProcess.MainWindowHandle -ne 0) {
    $windowProcess = $candidateProcess
    $resolvedWindowHandle = $candidateProcess.MainWindowHandle
  }
} else {
  $windowProcess = Get-Process | Where-Object {
    $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like "*$WindowTitle*"
  } | Sort-Object StartTime -Descending | Select-Object -First 1

  if ($windowProcess) {
    $resolvedWindowHandle = $windowProcess.MainWindowHandle
  }
}

if ($resolvedWindowHandle -eq [IntPtr]::Zero) {
  if (-not $Url) {
    throw "Could not find a game window whose title contains '$WindowTitle'."
  }

  $browserExe = Find-BrowserExe -Preferred $Browser

  if (-not $browserExe) {
    throw "Could not find $Browser for headless capture."
  }

  & $browserExe `
    "--headless=new" `
    "--disable-gpu" `
    "--hide-scrollbars" `
    "--window-size=1280,960" `
    "--virtual-time-budget=12000" `
    "--screenshot=$OutputPath" `
    $Url

  if (-not (Test-Path -LiteralPath $OutputPath)) {
    throw "Headless capture failed for $Url."
  }

  Write-Output $OutputPath
  exit 0
}

[WindowCaptureNative]::ShowWindowAsync(
  $resolvedWindowHandle,
  [WindowCaptureNative]::SW_RESTORE
) | Out-Null

if ($MaximizeWindow) {
  [WindowCaptureNative]::ShowWindowAsync(
    $resolvedWindowHandle,
    [WindowCaptureNative]::SW_MAXIMIZE
  ) | Out-Null
} else {
  [WindowCaptureNative]::MoveWindow(
    $resolvedWindowHandle,
    $WindowX,
    $WindowY,
    $WindowWidth,
    $WindowHeight,
    $true
  ) | Out-Null
}

[void][System.Windows.Forms.Application]::DoEvents()
[System.Windows.Forms.SendKeys]::SendWait("%")
[WindowCaptureNative]::SetForegroundWindow($resolvedWindowHandle) | Out-Null

if ($windowProcess) {
  try {
    $appActivator = New-Object -ComObject WScript.Shell
    $appActivator.AppActivate([int]$windowProcess.Id) | Out-Null
  } catch {
  }
}

[WindowCaptureNative]::SetForegroundWindow($resolvedWindowHandle) | Out-Null
Start-Sleep -Milliseconds $DelayMs

$rect = New-Object WindowCaptureNative+RECT
$width = 0
$height = 0

for ($attempt = 0; $attempt -lt 8; $attempt += 1) {
  [WindowCaptureNative]::GetWindowRect($resolvedWindowHandle, [ref]$rect) | Out-Null
  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top

  if ($width -gt 0 -and $height -gt 0) {
    break
  }

  Start-Sleep -Milliseconds 120
}

if ($width -le 0 -or $height -le 0) {
  throw "The game window bounds were invalid."
}

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

try {
  $graphics.CopyFromScreen(
    [System.Drawing.Point]::new($rect.Left, $rect.Top),
    [System.Drawing.Point]::Empty,
    [System.Drawing.Size]::new($width, $height)
  )
  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Output $OutputPath
