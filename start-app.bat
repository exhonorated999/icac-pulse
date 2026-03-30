@echo off
echo ========================================
echo ICAC P.U.L.S.E. - Quick Start
echo ========================================
echo.
echo Stopping any running processes...
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo.
echo Starting development server...
echo.
npm run dev
