# Test Portable Mode - Quick Switcher
# Run this to enable portable mode and test login features

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "ICAC P.U.L.S.E. - Portable Mode Tester" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan

# Kill any running Electron processes
Write-Host "Stopping Electron processes..." -ForegroundColor Gray
taskkill /F /IM electron.exe 2>$null | Out-Null

# Create portable marker
$portableMarker = "$env:APPDATA\ICAC_CaseManager\.portable"
Write-Host "Creating portable marker file..." -ForegroundColor Gray
New-Item -Path $portableMarker -ItemType File -Force | Out-Null

# Optional: Delete database to force fresh registration
$choice = Read-Host "`nDo you want to DELETE the database for fresh registration? (y/n)"
if ($choice -eq 'y') {
    $database = "$env:APPDATA\ICAC_CaseManager\database.db"
    if (Test-Path $database) {
        Remove-Item -Path $database -Force
        Write-Host "Database deleted - you'll see registration screen" -ForegroundColor Green
    }
} else {
    Write-Host "Keeping existing database" -ForegroundColor Gray
}

Write-Host "`n✓ Portable mode enabled!" -ForegroundColor Green
Write-Host "`nStarting application in portable mode..." -ForegroundColor Cyan
Write-Host "You should now see:" -ForegroundColor Yellow
Write-Host "  • Login/Registration screen (if no user registered)" -ForegroundColor White
Write-Host "  • 'Portable Mode Active' badge" -ForegroundColor White
Write-Host "  • Password change option in Settings" -ForegroundColor White
Write-Host "`n========================================`n" -ForegroundColor Cyan

# Start dev server
npm run dev
