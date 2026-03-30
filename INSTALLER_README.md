# ICAC P.U.L.S.E. Installer Build Guide

## Overview
This guide explains how to build the NSIS and MSI installers for ICAC P.U.L.S.E.

## Build Outputs

When you run `npm run dist`, the following installers are created in the `dist/` folder:

### 1. NSIS Installer (Recommended)
**File:** `ICAC P.U.L.S.E.-1.0.0-Setup.exe`

**Features:**
- Custom installation wizard
- License agreement display
- Desktop & Start Menu shortcuts
- Choose installation directory
- Hardware-bound installation
- Data retention option on uninstall
- Administrator privileges required

**Best For:** Standard Windows installations, IT departments, managed deployments

### 2. MSI Installer
**File:** `ICAC P.U.L.S.E.-1.0.0-Setup.msi`

**Features:**
- Windows Installer technology
- Group Policy deployment support
- Enterprise installation
- Standardized uninstall
- System Center/SCCM compatible

**Best For:** Enterprise environments, Active Directory deployments, SCCM/Intune

### 3. Portable Version
**File:** `ICAC P.U.L.S.E.-1.0.0-Portable.exe`

**Features:**
- No installation required
- Run from USB drive or external storage
- Data stored next to executable
- Perfect for air-gapped systems
- No administrator privileges needed

**Best For:** Forensic workstations, air-gapped systems, field operations

## Building the Installers

### Prerequisites
```powershell
# Install dependencies
npm install
```

### Build Commands

**Full Build (All Installers):**
```powershell
npm run dist
```

This creates:
- NSIS installer (.exe)
- MSI installer (.msi)
- Portable version (.exe)

**Build Specific Target:**
```powershell
# NSIS only
npx electron-builder --win nsis

# MSI only
npx electron-builder --win msi

# Portable only
npx electron-builder --win portable
```

### Quick Build Commands

**Option 1: Use the batch file**
```cmd
build-installer.bat
```

**Option 2: Use npm script**
```powershell
npm run build    # Compile TypeScript
npm run dist     # Build installers
```

## Installer Configuration

All installer settings are in `electron-builder.yml`:

### NSIS Settings
```yaml
nsis:
  oneClick: false                          # Show installation wizard
  allowToChangeInstallationDirectory: true # Let user choose install path
  createDesktopShortcut: always            # Always create desktop shortcut
  perMachine: true                         # Install for all users
  runAfterFinish: true                     # Launch app after install
  deleteAppDataOnUninstall: false          # Keep case data on uninstall
  license: LICENSE.txt                     # Show EULA
  include: build/installer.nsh             # Custom NSIS script
```

### MSI Settings
```yaml
msi:
  perMachine: true                         # Install for all users
  createDesktopShortcut: always            # Desktop shortcut
  createStartMenuShortcut: true            # Start menu entry
```

## Custom NSIS Features

The `build/installer.nsh` file adds:

### Installation Warnings
- Shows security notice about hardware binding
- Explains data storage location
- Confirms law enforcement use only

### Uninstall Protection
- Asks user if they want to keep case data
- Default: KEEPS data (safe option)
- Warns that deletion is permanent

### Version Information
- Product name, company, copyright
- File version and description
- Visible in Windows Properties

## Data Storage Locations

### Installed Mode (NSIS/MSI)
```
C:\ProgramData\ICAC_CaseManager\
├── database.db
├── cases\
│   └── [case folders]
└── config.json
```
**Note:** Hardware-bound, tied to C: drive

### Portable Mode
```
[Portable App Directory]\ICAC_Data\
├── database.db
├── cases\
│   └── [case folders]
└── config.json
```
**Note:** Portable marker file (`portable.txt`) enables this mode

## Testing the Installers

### NSIS Installer Test
1. Double-click `ICAC P.U.L.S.E.-1.0.0-Setup.exe`
2. Verify license agreement displays
3. Choose installation directory
4. Complete installation
5. Verify desktop shortcut created
6. Launch application
7. Verify data path: `C:\ProgramData\ICAC_CaseManager`

### MSI Installer Test
1. Double-click `ICAC P.U.L.S.E.-1.0.0-Setup.msi`
2. Follow Windows Installer wizard
3. Complete installation
4. Launch from Start Menu
5. Verify application runs

### Portable Version Test
1. Copy `.exe` to USB drive
2. Run without installation
3. Verify data stored next to executable
4. Test on different computer (should work)

## Uninstall Testing

### NSIS Uninstall
1. Go to Settings > Apps & features
2. Find "ICAC P.U.L.S.E."
3. Click Uninstall
4. **Important:** Choose to KEEP data when prompted
5. Verify `C:\ProgramData\ICAC_CaseManager` still exists

### MSI Uninstall
1. Go to Settings > Apps & features
2. Find "ICAC P.U.L.S.E."
3. Click Uninstall
4. Follow Windows Installer wizard
5. Data is preserved by default

## Distribution Checklist

Before distributing installers:

- [ ] Update version in `package.json`
- [ ] Update copyright year in `LICENSE.txt`
- [ ] Run `npm run dist` to build all installers
- [ ] Test NSIS installer on clean Windows 10/11
- [ ] Test MSI installer on clean Windows 10/11
- [ ] Test portable version on USB drive
- [ ] Verify hardware binding works
- [ ] Verify data storage locations
- [ ] Test uninstall process
- [ ] Verify case data preserved after uninstall
- [ ] Check installer file sizes (~150-200MB each)

## Installer File Sizes

Typical sizes:
- NSIS Setup.exe: ~180MB
- MSI Setup.msi: ~180MB
- Portable.exe: ~180MB

These sizes include:
- Electron runtime
- Chromium engine
- Node.js
- All dependencies
- Application code

## Troubleshooting

### Build Fails
```powershell
# Clean build
rmdir /s /q dist out dist-electron
npm run build
npm run dist
```

### Installer Won't Run
- Right-click > Run as Administrator
- Check Windows Defender / Antivirus
- Verify file not corrupted (re-download)

### MSI Installation Error
- Ensure no other version installed
- Run: `msiexec /x {ProductCode}` to force uninstall
- Clear Windows Installer cache

### Portable Version Issues
- Ensure write permissions to directory
- Check `portable.txt` marker file exists
- Verify not running from write-protected location

## Advanced: Silent Installation

### NSIS Silent Install
```powershell
"ICAC P.U.L.S.E.-1.0.0-Setup.exe" /S /D=C:\Program Files\ICAC_PULSE
```

### MSI Silent Install
```powershell
msiexec /i "ICAC P.U.L.S.E.-1.0.0-Setup.msi" /quiet /norestart
```

### MSI Silent Uninstall
```powershell
msiexec /x "ICAC P.U.L.S.E.-1.0.0-Setup.msi" /quiet /norestart
```

## Support

For build issues:
- Check `build-log.txt` for errors
- Review `dist/` folder contents
- Verify `electron-builder.yml` syntax

For runtime issues:
- Check Windows Event Viewer
- Review application logs
- Verify database permissions

---

**Last Updated:** February 2026  
**Version:** 1.0.0  
**Maintainer:** Intellect LE, LLC
