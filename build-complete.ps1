Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "ICAC CASE MANAGER - COMPLETE BUILD (Code + Installer)" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "H:\Workspace\icac_case_manager"

Write-Host "Project Directory: $(Get-Location)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Step 1/2: Building application code..." -ForegroundColor Yellow
Write-Host ""

npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Red
    Write-Host "BUILD FAILED!" -ForegroundColor Red
    Write-Host "================================================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Green
Write-Host "CODE BUILD COMPLETED!" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Step 2/2: Creating installer..." -ForegroundColor Yellow
Write-Host "This will take several minutes..." -ForegroundColor Yellow
Write-Host ""

npm run dist

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan

if ($LASTEXITCODE -eq 0) {
    Write-Host "BUILD COMPLETE - SUCCESS!" -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "New features included:" -ForegroundColor Green
    Write-Host "  ✓ Storage migration - Change case files location" -ForegroundColor White
    Write-Host "  ✓ Outreach Materials - Manage presentation files" -ForegroundColor White
    Write-Host "  ✓ Resources Library - Centralized document repository" -ForegroundColor White
    Write-Host "  ✓ PDF Report fix - Case Status Distribution on page 2" -ForegroundColor White
    Write-Host ""
    Write-Host "Installer Location:" -ForegroundColor Green
    Write-Host "  H:\Workspace\icac_case_manager\dist\" -ForegroundColor White
    Write-Host ""
    Write-Host "Look for:" -ForegroundColor Yellow
    Write-Host "  - ICAC P.U.L.S.E. Setup 1.0.0.exe" -ForegroundColor White
    Write-Host ""
    
    # Try to open the dist folder
    if (Test-Path "H:\Workspace\icac_case_manager\dist") {
        Write-Host "Opening dist folder..." -ForegroundColor Green
        Start-Process explorer.exe "H:\Workspace\icac_case_manager\dist"
    }
} else {
    Write-Host "INSTALLER BUILD FAILED! Exit code: $LASTEXITCODE" -ForegroundColor Red
    Write-Host "================================================================================" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
