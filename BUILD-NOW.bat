@echo off
echo ================================================================================
echo ICAC CASE MANAGER - COMPLETE BUILD
echo ================================================================================
echo.
echo Starting complete build process...
echo This will take 5-10 minutes.
echo.

cd /d H:\Workspace\icac_case_manager

echo Step 1/2: Building application code...
echo.
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ================================================================================
    echo BUILD FAILED!
    echo ================================================================================
    pause
    exit /b 1
)

echo.
echo ================================================================================
echo CODE BUILD SUCCESSFUL!
echo ================================================================================
echo.
echo Step 2/2: Creating installer...
echo This may take several minutes...
echo.

call npm run dist

echo.
echo ================================================================================
if %ERRORLEVEL% EQU 0 (
    echo BUILD COMPLETE - SUCCESS!
    echo ================================================================================
    echo.
    echo New features included:
    echo   - Storage migration ^(change case files location^)
    echo   - Outreach Materials ^(manage presentations^)
    echo   - Resources Library ^(document repository^)
    echo   - Offense Reference ^(charges and sentencing^)
    echo   - PDF Report fix ^(Case Status on page 2^)
    echo.
    echo Installer Location:
    echo   H:\Workspace\icac_case_manager\dist\
    echo.
    echo Opening dist folder...
    start explorer.exe "H:\Workspace\icac_case_manager\dist"
) else (
    echo BUILD FAILED! Exit code: %ERRORLEVEL%
    echo ================================================================================
)

echo.
pause
