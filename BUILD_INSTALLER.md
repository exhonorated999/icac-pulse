# Build NSIS Installer Guide

## Overview

This guide explains how to build the NSIS installer for ICAC P.U.L.S.E. with security features.

---

## Prerequisites

### 1. NSIS Installed (Required)

**Download and Install:**
- Go to: https://nsis.sourceforge.io/Download
- Download: NSIS 3.x (latest stable)
- Install to default location: `C:\Program Files (x86)\NSIS\`

**Verify Installation:**
```powershell
Test-Path "C:\Program Files (x86)\NSIS\makensis.exe"
```
Should return: `True`

### 2. Node Modules Installed

```powershell
npm install
```

### 3. Clean Build State

```powershell
# Remove old builds
Remove-Item -Path dist -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path dist-electron -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path out -Recurse -Force -ErrorAction SilentlyContinue
```

---

## Build Process

### Step 1: Build the Application

```powershell
npm run build
```

**Expected Output:**
```
✓ Building main process
✓ Building renderer
✓ Build complete
```

**Time:** 30-60 seconds

### Step 2: Create Installer

```powershell
npm run dist
```

**What This Does:**
1. Packages the Electron app
2. Runs NSIS to create installer
3. Includes custom installer.nsh script
4. Applies security configurations
5. Creates signed executable (if configured)

**Expected Output:**
```
• electron-builder  version=24.x.x
• loaded configuration  file=electron-builder.yml
• description is missed in the package.json  appId=com.icac.pulse
• building        target=nsis file=dist\ICAC P.U.L.S.E.-1.0.0-Setup.exe
• building        target=msi
• building        target=portable
```

**Time:** 2-5 minutes

**Output Files:**
```
dist/
├── ICAC P.U.L.S.E.-1.0.0-Setup.exe          (NSIS Installer)
├── ICAC P.U.L.S.E.-1.0.0-Setup.exe.blockmap
├── ICAC P.U.L.S.E.-1.0.0-Setup.msi          (MSI Installer)
├── ICAC P.U.L.S.E.-1.0.0-Portable.exe       (Portable Version)
└── latest.yml
```

---

## Installer Features

### NSIS Installer (Recommended)

**File:** `ICAC P.U.L.S.E.-1.0.0-Setup.exe`

**Features:**
- ✅ Custom installation directory selection
- ✅ License agreement display
- ✅ Desktop shortcut creation
- ✅ Start Menu shortcut creation
- ✅ Automatic .installed marker creation
- ✅ Hardware binding setup
- ✅ Security notifications
- ✅ Uninstaller with data retention options
- ✅ Registry keys for tracking
- ✅ AppData directory setup

**Installation Flow:**
```
1. Welcome screen with security information
2. License agreement
3. Installation directory selection
4. Installing files
5. Creating shortcuts
6. Setting up security markers
7. Registry configuration
8. Success message with instructions
9. Launch application
```

**Security Features:**
- Creates `.installed` marker in `%APPDATA%\ICAC_CaseManager\`
- Does NOT create `.portable` marker
- Ensures hardware-bound mode (no password)
- Registry keys track installation
- Hidden marker files prevent tampering

---

## Build Scripts

### Quick Build Script

Create `build-installer.bat`:

```batch
@echo off
echo ========================================
echo Building ICAC P.U.L.S.E. Installer
echo ========================================
echo.

echo Step 1: Cleaning old builds...
if exist dist rmdir /s /q dist
if exist dist-electron rmdir /s /q dist-electron
if exist out rmdir /s /q out
echo.

echo Step 2: Building application...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)
echo.

echo Step 3: Creating installers...
call npm run dist
if errorlevel 1 (
    echo ERROR: Installer creation failed!
    pause
    exit /b 1
)
echo.

echo ========================================
echo Build Complete!
echo ========================================
echo.
echo Output files in: dist\
dir dist\*.exe /b
echo.
pause
```

### PowerShell Build Script

Create `build-installer.ps1`:

```powershell
# ICAC P.U.L.S.E. - Build Installer Script

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Building ICAC P.U.L.S.E. Installer" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Clean
Write-Host "Step 1: Cleaning old builds..." -ForegroundColor White
Remove-Item -Path dist -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path dist-electron -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path out -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "✓ Clean complete`n" -ForegroundColor Green

# Step 2: Build
Write-Host "Step 2: Building application..." -ForegroundColor White
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Build complete`n" -ForegroundColor Green

# Step 3: Create Installer
Write-Host "Step 3: Creating installers..." -ForegroundColor White
npm run dist
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Installer creation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Installers created`n" -ForegroundColor Green

# Show results
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Build Complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Output files:" -ForegroundColor White
Get-ChildItem dist\*.exe, dist\*.msi | Select-Object Name, @{Name="Size (MB)";Expression={"{0:N2}" -f ($_.Length / 1MB)}}

Write-Host "`nReady for distribution!" -ForegroundColor Green
```

---

## Testing the Installer

### Test on Clean Machine

**Recommended Test Environment:**
- Windows 10 or 11
- No previous installation
- Standard user account (non-admin OK)
- No development tools needed

### Test Procedure

1. **Copy installer to test machine**
   ```
   Copy: ICAC P.U.L.S.E.-1.0.0-Setup.exe
   To: Test machine (USB drive or network)
   ```

2. **Run installer**
   ```
   Double-click: ICAC P.U.L.S.E.-1.0.0-Setup.exe
   ```

3. **Verify installation flow**
   - [ ] Welcome screen shows security info
   - [ ] License agreement displays
   - [ ] Can choose install directory
   - [ ] Installation completes successfully
   - [ ] Security message displays
   - [ ] Desktop shortcut created
   - [ ] Start Menu shortcut created

4. **Launch application**
   - [ ] Application starts
   - [ ] NO login screen (auto-login)
   - [ ] Dashboard loads immediately
   - [ ] Username shows "Officer"

5. **Verify security**
   - [ ] Check for `.installed` marker:
     ```powershell
     Test-Path "$env:APPDATA\ICAC_CaseManager\.installed"
     ```
     Should return: `True`
   
   - [ ] No `.portable` marker:
     ```powershell
     Test-Path "$env:APPDATA\ICAC_CaseManager\.portable"
     ```
     Should return: `False`
   
   - [ ] Settings has NO Security section (correct for installed mode)

6. **Test uninstaller**
   - [ ] Run uninstaller from Control Panel
   - [ ] Asked about keeping data
   - [ ] Choose to keep data
   - [ ] Verify data preserved after uninstall
   - [ ] Reinstall and data loads correctly

---

## Portable Version

### Creating Portable USB Version

**File:** `ICAC P.U.L.S.E.-1.0.0-Portable.exe`

**Steps:**

1. **Copy portable executable to USB drive**
   ```
   Copy: dist\ICAC P.U.L.S.E.-1.0.0-Portable.exe
   To: USB:\ICAC_PULSE\
   ```

2. **Create portable marker**
   ```powershell
   # On USB drive
   New-Item -Path "USB:\ICAC_PULSE\.portable" -ItemType File -Force
   ```

3. **Create data folder**
   ```
   USB:\
   ├── ICAC_PULSE\
   │   ├── ICAC P.U.L.S.E.-1.0.0-Portable.exe
   │   ├── .portable (marker file)
   │   └── data\ (created automatically)
   ```

4. **Test portable mode**
   - [ ] Run from USB
   - [ ] Shows login/registration screen
   - [ ] "Portable Mode Active" badge visible
   - [ ] Password authentication required
   - [ ] Settings has Security section

---

## Troubleshooting

### "NSIS Not Found" Error

**Error:**
```
Cannot find NSIS. Install NSIS 3.x.x
```

**Solution:**
1. Install NSIS from https://nsis.sourceforge.io/Download
2. Add to PATH or install to default location
3. Restart terminal
4. Try again

### "Build Failed" Error

**Solution:**
```powershell
# Clean everything
Remove-Item -Path node_modules -Recurse -Force
Remove-Item -Path dist -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path dist-electron -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path out -Recurse -Force -ErrorAction SilentlyContinue

# Reinstall
npm install

# Build again
npm run build
npm run dist
```

### "Installer Won't Run" Error

**Possible Causes:**
- Windows SmartScreen blocking
- Antivirus blocking
- Unsigned executable

**Solution:**
- Right-click → Properties → Unblock
- Or: Add exception in antivirus
- Or: Code sign the executable (for production)

### Installer Size Too Large

**Expected Size:** 150-250 MB

**If larger:**
- Check what's being packaged
- Remove unnecessary files from `files` section in electron-builder.yml
- Use asar packaging (already enabled)

---

## Distribution

### For Internal Testing

1. **Build installer**
   ```powershell
   npm run dist
   ```

2. **Test locally**
   - Install on test machine
   - Verify all features work
   - Test uninstall/reinstall

3. **Distribute to testers**
   - Copy `.exe` to network share
   - Or: Email (if size allows)
   - Or: USB drive

### For Production Deployment

1. **Code Signing (Recommended)**
   - Get code signing certificate
   - Configure in electron-builder.yml
   - Sign the executable

2. **Create distribution package**
   ```
   Distribution Package:
   ├── ICAC P.U.L.S.E.-1.0.0-Setup.exe
   ├── README.txt (Installation instructions)
   ├── LICENSE.txt
   └── RELEASE_NOTES.txt
   ```

3. **Deployment methods**
   - Network share for department
   - USB distribution
   - Email (compressed)
   - Internal software portal

---

## Build Checklist

Before building final installer:

- [ ] All features tested and working
- [ ] Version number updated in package.json
- [ ] LICENSE.txt file present
- [ ] Icon files present in build/
- [ ] No debug code or console.logs
- [ ] Database migrations tested
- [ ] Security features verified
- [ ] Documentation complete
- [ ] EULA reviewed and updated
- [ ] Build on clean machine works
- [ ] Installer tested on Windows 10 and 11

---

## Version Management

### Updating Version

**File:** `package.json`

```json
{
  "name": "icac-pulse",
  "version": "1.0.0",  ← Update this
  "description": "ICAC Case Management System"
}
```

**Version Format:** `MAJOR.MINOR.PATCH`
- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Bug fixes

**Example:**
```
1.0.0 → First release
1.0.1 → Bug fix
1.1.0 → New feature added
2.0.0 → Major overhaul
```

---

## Quick Reference

### Build Commands

```powershell
# Full build
npm run build && npm run dist

# Clean build
Remove-Item dist -Recurse -Force; npm run build; npm run dist

# Build specific target
npm run dist -- --win nsis

# Build portable only
npm run dist -- --win portable
```

### Output Files

| File | Purpose | Size |
|------|---------|------|
| `*-Setup.exe` | NSIS Installer (Recommended) | ~150MB |
| `*-Setup.msi` | MSI Installer (Enterprise) | ~150MB |
| `*-Portable.exe` | USB Portable Version | ~150MB |

### Installer Locations

**After Installation:**
- **Program:** `C:\Program Files\ICAC P.U.L.S.E.\`
- **Data:** `%APPDATA%\ICAC_CaseManager\`
- **Shortcuts:** Desktop + Start Menu
- **Uninstaller:** Control Panel → Programs

---

## Summary

Building the NSIS installer:

1. ✅ Clean old builds
2. ✅ Run `npm run build`
3. ✅ Run `npm run dist`
4. ✅ Test installer on clean machine
5. ✅ Verify security features
6. ✅ Distribute to users

The installer includes:
- ✅ Custom security messages
- ✅ Hardware binding setup
- ✅ Proper marker file creation
- ✅ Registry configuration
- ✅ Uninstall with data options
- ✅ Professional appearance
- ✅ EULA display
- ✅ Shortcut creation

**Ready for production deployment!**
