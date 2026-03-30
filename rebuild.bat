@echo off
echo ================================================================================
echo ICAC CASE MANAGER - REBUILD SCRIPT
echo ================================================================================
echo.
echo Starting build process...
echo.

cd /d H:\Workspace\icac_case_manager
call npm run build

echo.
echo ================================================================================
if %ERRORLEVEL% EQU 0 (
    echo BUILD COMPLETED SUCCESSFULLY!
    echo.
    echo Output Location:
    echo   H:\Workspace\icac_case_manager\out\
    echo.
    echo Executable:
    echo   H:\Workspace\icac_case_manager\out\main\index.js
) else (
    echo BUILD FAILED! Exit code: %ERRORLEVEL%
)
echo ================================================================================
pause
