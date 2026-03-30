# Test Installed Mode - Quick Switcher
# Run this to disable portable mode and test default behavior

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "ICAC P.U.L.S.E. - Installed Mode Tester" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan

# Kill any running Electron processes
Write-Host "Stopping Electron processes..." -ForegroundColor Gray
taskkill /F /IM electron.exe 2>$null | Out-Null

# Remove portable marker
$portableMarker = "$env:APPDATA\ICAC_CaseManager\.portable"
if (Test-Path $portableMarker) {
    Remove-Item -Path $portableMarker -Force
    Write-Host "Portable marker removed" -ForegroundColor Green
} else {
    Write-Host "Portable marker was not present" -ForegroundColor Gray
}

Write-Host "`n✓ Installed mode enabled!" -ForegroundColor Green
Write-Host "`nStarting application in installed mode..." -ForegroundColor Cyan
Write-Host "You should now see:" -ForegroundColor Yellow
Write-Host "  • No login screen (auto-login)" -ForegroundColor White
Write-Host "  • Dashboard loads immediately" -ForegroundColor White
Write-Host "  • No password change in Settings" -ForegroundColor White
Write-Host "`n========================================`n" -ForegroundColor Cyan

# Start dev server
npm run dev
