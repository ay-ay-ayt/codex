param(
  [Parameter(Mandatory = $true)]
  [string]$Path,
  [int]$SampleStride = 4
)

$ErrorActionPreference = "Stop"

$resolvedPath = [System.IO.Path]::GetFullPath($Path)

if (-not (Test-Path -LiteralPath $resolvedPath)) {
  throw "Capture not found: $resolvedPath"
}

Add-Type -AssemblyName System.Drawing

$bitmap = [System.Drawing.Bitmap]::FromFile($resolvedPath)

try {
  $sampleCount = 0
  $totalLuma = 0.0
  $darkSamples = 0
  $brightSamples = 0
  $stride = [Math]::Max(1, $SampleStride)

  for ($y = 0; $y -lt $bitmap.Height; $y += $stride) {
    for ($x = 0; $x -lt $bitmap.Width; $x += $stride) {
      $pixel = $bitmap.GetPixel($x, $y)
      $luma = ((0.2126 * $pixel.R) + (0.7152 * $pixel.G) + (0.0722 * $pixel.B)) / 255.0

      $sampleCount += 1
      $totalLuma += $luma

      if ($luma -le 0.08) {
        $darkSamples += 1
      }

      if ($luma -ge 0.72) {
        $brightSamples += 1
      }
    }
  }

  [pscustomobject]@{
    path = $resolvedPath
    width = $bitmap.Width
    height = $bitmap.Height
    sampleStride = $stride
    samples = $sampleCount
    averageLuma = [Math]::Round($totalLuma / [Math]::Max(1, $sampleCount), 4)
    darkPixelRatio = [Math]::Round($darkSamples / [Math]::Max(1, $sampleCount), 4)
    brightPixelRatio = [Math]::Round($brightSamples / [Math]::Max(1, $sampleCount), 4)
  } | ConvertTo-Json -Compress
} finally {
  $bitmap.Dispose()
}
