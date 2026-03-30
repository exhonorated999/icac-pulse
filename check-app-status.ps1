# Check Application Status

Write-Host "`n=== ICAC P.U.L.S.E. Status Check ===" -ForegroundColor Cyan
Write-Host ""

# Check portable marker
$portableMarker = "$env:APPDATA\ICAC_CaseManager\.portable"
$hasMarker = Test-Path $portableMarker
Write-Host "Portable Marker File:" -NoNewline
if ($hasMarker) {
    Write-Host " ✓ EXISTS" -ForegroundColor Green
    Write-Host "  Location: $portableMarker" -ForegroundColor Gray
} else {
    Write-Host " ✗ NOT FOUND" -ForegroundColor Red
    Write-Host "  Expected: $portableMarker" -ForegroundColor Gray
}
Write-Host ""

# Check database
$database = "$env:APPDATA\ICAC_CaseManager\database.db"
$hasDb = Test-Path $database
Write-Host "Database File:" -NoNewline
if ($hasDb) {
    Write-Host " ✓ EXISTS" -ForegroundColor Green
    $dbSize = (Get-Item $database).Length / 1MB
    Write-Host "  Location: $database" -ForegroundColor Gray
    Write-Host "  Size: $($dbSize.ToString('0.##')) MB" -ForegroundColor Gray
} else {
    Write-Host " ✗ NOT FOUND" -ForegroundColor Red
    Write-Host "  Expected: $database" -ForegroundColor Gray
}
Write-Host ""

# Check for Electron processes
$electronProcesses = Get-Process electron -ErrorAction SilentlyContinue
Write-Host "Electron Processes:" -NoNewline
if ($electronProcesses) {
    Write-Host " ✓ RUNNING ($($electronProcesses.Count) process(es))" -ForegroundColor Green
    foreach ($proc in $electronProcesses) {
        Write-Host "  PID: $($proc.Id)" -ForegroundColor Gray
        if ($proc.MainWindowTitle) {
            Write-Host "  Window: $($proc.MainWindowTitle)" -ForegroundColor Gray
        } else {
            Write-Host "  Window: (no title - may be hidden)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host " ✗ NOT RUNNING" -ForegroundColor Red
}
Write-Host ""

# Check for Node processes
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
Write-Host "Node Processes:" -NoNewline
if ($nodeProcesses) {
    Write-Host " ✓ RUNNING ($($nodeProcesses.Count) process(es))" -ForegroundColor Green
} else {
    Write-Host " ✗ NOT RUNNING" -ForegroundColor Red
}
Write-Host ""

# Expected mode
Write-Host "Expected Mode:" -NoNewline
if ($hasMarker) {
    Write-Host " PORTABLE (login required)" -ForegroundColor Cyan
    Write-Host "  • Should show login/registration screen" -ForegroundColor Gray
    Write-Host "  • Should have 'Portable Mode Active' badge" -ForegroundColor Gray
    Write-Host "  • Settings should have Security section" -ForegroundColor Gray
} else {
    Write-Host " INSTALLED (auto-login)" -ForegroundColor Cyan
    Write-Host "  • Should show dashboard immediately" -ForegroundColor Gray
    Write-Host "  • No login screen" -ForegroundColor Gray
    Write-Host "  • No Security section in Settings" -ForegroundColor Gray
}
Write-Host ""

# Recommendations
Write-Host "=== Recommendations ===" -ForegroundColor Cyan
Write-Host ""

if (-not $electronProcesses) {
    Write-Host "❌ Electron is not running!" -ForegroundColor Red
    Write-Host "   Run: npm run dev" -ForegroundColor Yellow
    Write-Host ""
}

if ($hasMarker -and -not $hasDb) {
    Write-Host "✓ Portable mode enabled, no database" -ForegroundColor Green
    Write-Host "  You should see registration screen when app starts" -ForegroundColor Gray
    Write-Host ""
}

if ($hasMarker -and $hasDb) {
    Write-Host "✓ Portable mode enabled, database exists" -ForegroundColor Green
    Write-Host "  You should see login screen when app starts" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "=== Quick Commands ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Start app:           npm run dev" -ForegroundColor White
Write-Host "Enable portable:     .\test-portable-mode.ps1" -ForegroundColor White
Write-Host "Disable portable:    .\test-installed-mode.ps1" -ForegroundColor White
Write-Host "Fresh registration:  Remove-Item '$database' -Force" -ForegroundColor White
Write-Host ""
