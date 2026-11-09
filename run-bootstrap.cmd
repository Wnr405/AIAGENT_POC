@echo off
rem Double-click to install dependencies and run every quality gate. Logs: harness-reports\
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap.ps1"
echo.
pause
