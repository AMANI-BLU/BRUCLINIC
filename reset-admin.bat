@echo off
title Reset BruClinic Admin Credentials
cd /d "%~dp0"
echo Resetting admin credentials to admin / admin...
echo.
npm run admin:reset %*
echo.
pause
