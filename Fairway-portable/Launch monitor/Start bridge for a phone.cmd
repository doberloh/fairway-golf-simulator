@echo off
rem Fairway's launch-monitor bridge, for Windows. Double-click to start it.
rem It needs Node.js 20 or newer, installed once from https://nodejs.org
rem THIS ONE IS FOR PLAYING ON A PHONE: it opens the bridge to your home network.
title Fairway bridge
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Fairway's launch-monitor bridge needs Node.js, which is not installed.
  echo Install the LTS version from https://nodejs.org, then double-click this again.
  echo.
  pause
  exit /b 1
)
set FAIRWAY_HTTP_HOST=lan
node fairway-bridge.mjs
echo.
echo The bridge has stopped.
pause
