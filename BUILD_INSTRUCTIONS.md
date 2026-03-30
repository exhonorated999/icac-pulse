# Building ICAC P.U.L.S.E. for Distribution

## Overview
This document explains how to build the Windows installer for beta testing.

## Prerequisites
- Node.js and npm installed
- All dependencies installed (`npm install` already run)
- Project builds successfully in development mode

## Quick Build Method

### Option 1: Use the Build Script (Easiest)
1. Open File Explorer
2. Navigate to: `C:\Users\Justi\Workspace\icac_case_manager`
3. Double-click `build-installer.bat`
4. Wait for the build to complete (5-10 minutes)
5. Find the installer in the `dist` folder

### Option 2: Manual Build via Command Line
1. Open PowerShell or Command Prompt
2. Navigate to the project folder:
   ```
   cd C:\Users\Justi\Workspace\icac_case_manager
   ```
3. Run the package command:
   ```
   npm run package
   ```
4. Wait for completion
5. Check the `dist` folder for the installer

## What Gets Built

The build process creates:
- **Installer File**: `dist/ICAC P.U.L.S.E. Setup.exe` (~150-200 MB)
- **Unpacked Application**: `dist/win-unpacked/` (for testing without installing)

## Installer Features

The installer will:
- ✅ Allow users to choose installation directory
- ✅ Create desktop shortcut
- ✅ Create Start Menu shortcut
- ✅ Install as "ICAC P.U.L.S.E."
- ✅ Bind to hardware on first run
- ✅ Store data in `%APPDATA%\ICAC_CaseManager\`

## Testing the Build

### Before Distribution:
1. **Test the unpacked version first**:
   - Go to `dist/win-unpacked/`
   - Run `ICAC P.U.L.S.E..exe`
   - Verify it starts and works correctly

2. **Test the installer**:
   - Run `dist/ICAC P.U.L.S.E. Setup.exe`
   - Install to a test location
   - Verify installation completes
   - Test the installed application

3. **Test on a clean machine** (if possible):
   - Copy installer to another Windows 10/11 machine
   - Install and test
   - Verify hardware binding works

## Known Limitations

- **No Code Signing**: Installer is not digitally signed (will show Windows SmartScreen warning)
- **Windows Only**: Currently builds for Windows x64 only
- **Offline Only**: Application requires no internet connection after installation
- **Hardware Bound**: Cannot be copied between machines

## Distribution

### For Beta Testing:
1. Copy `dist/ICAC P.U.L.S.E. Setup.exe` to a USB drive or network share
2. Provide to beta testers
3. Include instructions:
   - Click through Windows SmartScreen warning (expected for unsigned apps)
   - Choose installation location
   - Run application
   - Register username on first launch

### Beta Tester Instructions

**Installation:**
1. Run `ICAC P.U.L.S.E. Setup.exe`
2. If Windows SmartScreen appears, click "More info" → "Run anyway"
3. Choose installation directory or use default
4. Complete installation

**First Run:**
1. Launch "ICAC P.U.L.S.E." from desktop or Start Menu
2. Enter your name/username when prompted
3. Application is now ready to use

**Important Notes:**
- Application is 100% offline - no internet required
- All data stored locally in `%APPDATA%\ICAC_CaseManager\`
- Application is bound to your computer's hardware
- Cannot be copied to another machine

## Troubleshooting

### Build Fails
- Ensure all dependencies are installed: `npm install`
- Check for TypeScript errors: `npm run build`
- Try cleaning: Delete `node_modules`, run `npm install` again

### Installer Won't Run
- Check Windows Defender/antivirus isn't blocking it
- Run as Administrator if needed
- Ensure Windows 10/11 64-bit

### Application Won't Start After Install
- Check %APPDATA%\ICAC_CaseManager\ exists
- Look for error logs
- Try running as Administrator

## File Sizes

Expected sizes:
- Installer: ~150-200 MB
- Installed application: ~200-250 MB
- Database (empty): ~100 KB
- Database (with cases): Varies based on content

## Support

For issues during beta testing:
- Check the database isn't corrupted: Delete `%APPDATA%\ICAC_CaseManager\database.db` and restart
- Hardware mismatch: Application must stay on the same machine
- Export cases before major updates

## Version Information

- **Version**: 1.0.0
- **Build**: Production
- **Target**: Windows x64
- **Electron**: 28.x
- **Node**: 20.x
