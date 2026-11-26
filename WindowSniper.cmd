@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\launch-windows.ps1" %*
if errorlevel 1 pause
