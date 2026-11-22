@echo off
title BruClinic Local Offline Server
cd /d "%~dp0"
echo Starting BruClinic in offline mode...
echo.
npm run dev
pause
