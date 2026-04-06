@echo off
pushd "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location -LiteralPath '%CD%'; npm.cmd run build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; Start-Process -FilePath '.\\node_modules\\electron\\dist\\electron.exe' -ArgumentList '.' -WorkingDirectory (Get-Location)"
if errorlevel 1 (
  echo Failed to build or start the app.
  pause
)
popd
