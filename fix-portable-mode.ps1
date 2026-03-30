# Fix Portable Mode Configuration
# Run this to convert installed version to portable mode

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Fix Portable Mode Configuration" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. Kill any running instances
Write-Host "Step 1: Stopping running instances..." -ForegroundColor White
taskkill /F /IM "ICAC P.U.L.S.E.exe" 2>$null | Out-Null
taskkill /F /IM electron.exe 2>$null | Out-Null
Start-Sleep -Seconds 1
Write-Host "- Done" -ForegroundColor Green

# 2. Remove installed marker
Write-Host "`nStep 2: Removing installed marker..." -ForegroundColor White
Remove-Item "$env:APPDATA\ICAC_CaseManager\.installed" -Force -ErrorAction SilentlyContinue
Write-Host "- Done" -ForegroundColor Green

# 3. Create portable marker
Write-Host "`nStep 3: Creating portable marker..." -ForegroundColor White
New-Item -Path "$env:APPDATA\ICAC_CaseManager\.portable" -ItemType File -Force | Out-Null
Write-Host "- Done" -ForegroundColor Green

# 4. Delete database for fresh registration
Write-Host "`nStep 4: Deleting database for fresh registration..." -ForegroundColor White
Remove-Item "$env:APPDATA\ICAC_CaseManager\database.db" -Force -ErrorAction SilentlyContinue
Write-Host "- Done" -ForegroundColor Green

# 5. Clean registry (requires admin)
Write-Host "`nStep 5: Cleaning registry..." -ForegroundColor White
try {
    Remove-Item "HKLM:\Software\ICAC_PULSE" -Recurse -Force -ErrorAction Stop
    Write-Host "- Done" -ForegroundColor Green
} catch {
    Write-Host "- Skipped (requires admin rights)" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Configuration Updated!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

# Verify
Write-Host "Verification:" -ForegroundColor White
$portableExists = Test-Path "$env:APPDATA\ICAC_CaseManager\.portable"
$installedExists = Test-Path "$env:APPDATA\ICAC_CaseManager\.installed"
$dbExists = Test-Path "$env:APPDATA\ICAC_CaseManager\database.db"

Write-Host "  Portable marker: " -NoNewline
if ($portableExists) { Write-Host "YES" -ForegroundColor Green } else { Write-Host "NO" -ForegroundColor Red }

Write-Host "  Installed marker: " -NoNewline
if ($installedExists) { Write-Host "YES" -ForegroundColor Red } else { Write-Host "NO" -ForegroundColor Green }

Write-Host "  Database: " -NoNewline
if ($dbExists) { Write-Host "EXISTS" -ForegroundColor Yellow } else { Write-Host "DELETED" -ForegroundColor Green }

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. Start ICAC P.U.L.S.E. from F: drive" -ForegroundColor White
Write-Host "2. You should see registration screen" -ForegroundColor White
Write-Host "3. Register with username and password" -ForegroundColor White
Write-Host "4. Settings will have Security section" -ForegroundColor White
Write-Host "`nIf it still doesn't work, run this script" -ForegroundColor Yellow
Write-Host "as Administrator (right-click > Run as Admin)`n" -ForegroundColor Yellow

pause
