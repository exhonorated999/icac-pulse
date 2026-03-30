# Build Installer Now - Simple Guide

## Problem

NSIS is not installed on this computer. You have two options:

---

## Option 1: Install NSIS and Build (Recommended)

### Step 1: Download NSIS

1. Open browser
2. Go to: **https://nsis.sourceforge.io/Download**
3. Download: **NSIS 3.10** (or latest 3.x version)
4. Run the installer
5. Accept default installation location

**Installation takes:** 1-2 minutes

### Step 2: Build Installer

Open a **NEW PowerShell window** and run:

```powershell
cd C:\Users\JUSTI\Workspace\icac_case_manager
.\build-installer-new.ps1
```

**Or simpler:**
```powershell
cd C:\Users\JUSTI\Workspace\icac_case_manager
npm run build
npm run dist
```

**Build time:** 3-5 minutes

### Result:

Files will be in `dist/` folder:
- `ICAC P.U.L.S.E.-1.0.0-Setup.exe` (NSIS installer with security features)
- `ICAC P.U.L.S.E.-1.0.0-Setup.msi` (MSI installer)
- `ICAC P.U.L.S.E.-1.0.0-Portable.exe` (Portable version)

---

## Option 2: Build Without NSIS (Quick Test)

If you don't want to install NSIS right now, you can still build the application:

### Step 1: Build Application Only

```powershell
cd C:\Users\JUSTI\Workspace\icac_case_manager
npm run build
```

This creates the compiled application in `out/` folder.

### Step 2: Package as Portable

```powershell
npm run dist -- --win portable
```

This creates only the portable `.exe` without needing NSIS.

**Result:** `dist/ICAC P.U.L.S.E.-1.0.0-Portable.exe`

---

## What Each File Does

### NSIS Installer (Needs NSIS installed)
**File:** `ICAC P.U.L.S.E.-*-Setup.exe`

**Features:**
- ✅ Professional installer with wizard
- ✅ Custom security messages
- ✅ Creates `.installed` marker file
- ✅ Sets up AppData directories
- ✅ Registry configuration
- ✅ Desktop and Start Menu shortcuts
- ✅ Smart uninstaller with data options
- ✅ Hardware binding setup

**Use for:** Desktop installations (recommended)

### MSI Installer (Needs NSIS installed)
**File:** `ICAC P.U.L.S.E.-*-Setup.msi`

**Features:**
- ✅ Windows Installer format
- ✅ Good for enterprise deployment
- ✅ Group Policy deployment
- ✅ Similar features to NSIS

**Use for:** Enterprise/IT department distribution

### Portable Executable (No NSIS needed)
**File:** `ICAC P.U.L.S.E.-*-Portable.exe`

**Features:**
- ✅ Single executable file
- ✅ No installation required
- ✅ Can run from USB drive
- ✅ Requires manual `.portable` marker

**Use for:** USB drive deployments

---

## Quick Command Reference

### Full Build (if NSIS installed):
```powershell
npm run build && npm run dist
```

### Portable Only (no NSIS needed):
```powershell
npm run build && npm run dist -- --win portable
```

### Just compile (no installer):
```powershell
npm run build
```

---

## Current Status

✅ **NSIS installer script created** (`build/installer.nsh`)
✅ **Security features implemented**
✅ **Build configuration ready** (`electron-builder.yml`)
✅ **Documentation complete**

❌ **NSIS not installed** on this computer

---

## Recommended Next Steps

### For Full Featured Installer:

1. **Install NSIS** (5 minutes)
   - Download from: https://nsis.sourceforge.io/Download
   - Run installer with defaults
   
2. **Open NEW PowerShell window**
   - (Important: New window to detect NSIS)
   
3. **Build installer**
   ```powershell
   cd C:\Users\JUSTI\Workspace\icac_case_manager
   npm run build
   npm run dist
   ```

4. **Find installers in:** `dist/` folder

### For Quick Test:

1. **Build portable version**
   ```powershell
   cd C:\Users\JUSTI\Workspace\icac_case_manager
   npm run build
   npm run dist -- --win portable
   ```

2. **Test:** `dist/ICAC P.U.L.S.E.-*-Portable.exe`

---

## Installation URLs

**NSIS Download:**
https://nsis.sourceforge.io/Download

**Direct Download Link:**
https://prdownloads.sourceforge.net/nsis/nsis-3.10-setup.exe

---

## Alternative: Use Existing Build Script

If you already have NSIS installed but the script isn't detecting it, manually run:

```powershell
cd C:\Users\JUSTI\Workspace\icac_case_manager

# Clean
Remove-Item dist -Recurse -Force -ErrorAction SilentlyContinue

# Build
npm run build

# Create installers
npm run dist
```

Wait 3-5 minutes for completion.

---

## Summary

**To build the NSIS installer with all security features:**

1. Install NSIS from: https://nsis.sourceforge.io/Download
2. Open new PowerShell
3. Run: `cd C:\Users\JUSTI\Workspace\icac_case_manager`
4. Run: `npm run build && npm run dist`
5. Wait 3-5 minutes
6. Find installers in `dist/` folder

**Everything is configured and ready - just need NSIS installed!**
