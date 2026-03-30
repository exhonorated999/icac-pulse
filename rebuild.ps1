Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "ICAC CASE MANAGER - BUILD PROCESS" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "H:\Workspace\icac_case_manager"

Write-Host "Project Directory: $(Get-Location)" -ForegroundColor Yellow
Write-Host "Starting build..." -ForegroundColor Yellow
Write-Host ""

npm run build

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan

if ($LASTEXITCODE -eq 0) {
    Write-Host "BUILD COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Output Location:" -ForegroundColor Green
    Write-Host "  H:\Workspace\icac_case_manager\out\" -ForegroundColor White
    Write-Host ""
    Write-Host "The PDF report changes are now built into the application." -ForegroundColor Green
} else {
    Write-Host "BUILD FAILED! Exit code: $LASTEXITCODE" -ForegroundColor Red
}

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
