Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "ICAC P.U.L.S.E. - Installer Builder" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan

# Get current directory
$projectDir = Get-Location
Write-Host "Project Directory: $projectDir" -ForegroundColor Gray

# Check if NSIS is installed
$nsisPath = "C:\Program Files (x86)\NSIS\makensis.exe"
if (-not (Test-Path $nsisPath)) {
    Write-Host "`n✗ NSIS not found!" -ForegroundColor Red
    Write-Host "  Please install NSIS from: https://nsis.sourceforge.io/Download" -ForegroundColor Yellow
    Write-Host "  Then run this script again.`n" -ForegroundColor Yellow
    pause
    exit 1
}
Write-Host "✓ NSIS found" -ForegroundColor Green

# Step 1: Clean old builds
Write-Host "`nStep 1: Cleaning old builds..." -ForegroundColor White
Remove-Item -Path dist -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path dist-electron -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path out -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "✓ Clean complete" -ForegroundColor Green

# Step 2: Build application
Write-Host "`nStep 2: Building application..." -ForegroundColor White
Write-Host "  This may take 30-60 seconds...`n" -ForegroundColor Gray

npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n✗ Build failed!" -ForegroundColor Red
    Write-Host "  Check the error messages above" -ForegroundColor Yellow
    pause
    exit 1
}
Write-Host "`n✓ Build complete" -ForegroundColor Green

# Step 3: Create installers
Write-Host "`nStep 3: Creating installers..." -ForegroundColor White
Write-Host "  This may take 2-5 minutes..." -ForegroundColor Gray
Write-Host "  Building: NSIS, MSI, and Portable versions`n" -ForegroundColor Gray

npm run dist

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n✗ Installer creation failed!" -ForegroundColor Red
    Write-Host "  Check the error messages above" -ForegroundColor Yellow
    pause
    exit 1
}

# Show results
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Build Complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Output files in: dist\`n" -ForegroundColor White

if (Test-Path "dist") {
    $files = Get-ChildItem dist\*.exe, dist\*.msi -ErrorAction SilentlyContinue
    if ($files) {
        $files | ForEach-Object {
            $sizeMB = "{0:N2}" -f ($_.Length / 1MB)
            Write-Host "  • $($_.Name)" -ForegroundColor White
            Write-Host "    Size: $sizeMB MB" -ForegroundColor Gray
        }
        
        Write-Host "`n========================================" -ForegroundColor Cyan
        Write-Host "Next Steps:" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "  1. Test installer on clean machine" -ForegroundColor White
        Write-Host "  2. Verify security features work" -ForegroundColor White
        Write-Host "  3. Check hardware binding" -ForegroundColor White
        Write-Host "  4. Test uninstall/reinstall" -ForegroundColor White
        Write-Host "  5. Distribute to users`n" -ForegroundColor White
        
        Write-Host "Recommended installer:" -ForegroundColor Yellow
        Write-Host "  ICAC P.U.L.S.E.-*-Setup.exe (NSIS)`n" -ForegroundColor Cyan
        
        # Ask if user wants to open dist folder
        $openFolder = Read-Host "Open dist folder? (y/n)"
        if ($openFolder -eq 'y') {
            Start-Process explorer.exe "$projectDir\dist"
        }
    } else {
        Write-Host "  No installer files found!" -ForegroundColor Red
    }
} else {
    Write-Host "  dist folder not found!" -ForegroundColor Red
}

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
