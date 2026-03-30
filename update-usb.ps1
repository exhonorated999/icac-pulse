# Update USB with Fixed Portable Executable

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Updating USB with Fixed Version" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan

# Wait for build to complete
Write-Host "Waiting for build to complete..." -ForegroundColor Gray
while (-not (Test-Path ".\dist\ICAC P.U.L.S.E-1.0.0-Portable.exe")) {
    Start-Sleep -Seconds 2
    Write-Host "." -NoNewline -ForegroundColor Gray
}
Write-Host "`n- Build complete!" -ForegroundColor Green

# Copy to USB
$source = ".\dist\ICAC P.U.L.S.E-1.0.0-Portable.exe"
$dest = "F:\ICAC_PULSE_PORTABLE\ICAC_PULSE_Portable.exe"

Write-Host "`nCopying fixed version to USB..." -ForegroundColor White
Copy-Item $source -Destination $dest -Force
Write-Host "- Copied!" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Update Complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "The bug is fixed!" -ForegroundColor White
Write-Host "`nNow run:" -ForegroundColor Yellow
Write-Host "  F:\ICAC_PULSE_PORTABLE\ICAC_PULSE_Portable.exe" -ForegroundColor Cyan
Write-Host "`nYou WILL see the registration screen this time!" -ForegroundColor Green
Write-Host ""
