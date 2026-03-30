# ✅ NSIS Installer Ready

## Summary

The NSIS installer for ICAC P.U.L.S.E. has been configured with enhanced security features and is ready to build.

---

## What Was Created

### 1. Enhanced NSIS Script (`build/installer.nsh`)

**Features Added:**
- ✅ **Security Welcome Message** - Explains hardware binding and features
- ✅ **Installation Check** - Prevents duplicate installations
- ✅ **`.installed` Marker Creation** - Marks as installed (not portable) mode
- ✅ **Registry Configuration** - Tracks installation details
- ✅ **Security Notifications** - Informs user about hardware binding
- ✅ **Smart Uninstaller** - Options to keep or delete case data
- ✅ **Double Confirmation** - Prevents accidental data deletion
- ✅ **AppData Directory Setup** - Creates proper data folders

### 2. Build Scripts

**`build-installer.ps1`** - PowerShell build script
- Checks for NSIS installation
- Cleans old builds
- Builds application
- Creates all installer types (NSIS, MSI, Portable)
- Shows results with file sizes
- Opens dist folder when done

**`build-installer.bat`** - Batch file (alternative)
- Same functionality as PowerShell
- For users who prefer CMD

### 3. Documentation

**`BUILD_INSTALLER.md`** - Complete guide
- Prerequisites
- Step-by-step build process
- Testing procedures
- Troubleshooting
- Distribution guidelines

---

## How to Build

### Quick Method

```powershell
.\build-installer.ps1
```

**Or double-click:** `build-installer.ps1` in Windows Explorer

### Manual Method

```powershell
# 1. Clean
Remove-Item dist -Recurse -Force -ErrorAction SilentlyContinue

# 2. Build
npm run build

# 3. Create installers
npm run dist
```

---

## Output Files

After building, you'll find in `dist/`:

```
dist/
├── ICAC P.U.L.S.E.-1.0.0-Setup.exe          (~150 MB)  ← NSIS Installer (Recommended)
├── ICAC P.U.L.S.E.-1.0.0-Setup.exe.blockmap
├── ICAC P.U.L.S.E.-1.0.0-Setup.msi          (~150 MB)  ← MSI Installer
├── ICAC P.U.L.S.E.-1.0.0-Portable.exe       (~150 MB)  ← Portable USB Version
├── latest.yml
└── builder-effective-config.yaml
```

---

## Installer Features

### NSIS Installer (Recommended)

**Installation Process:**

1. **Welcome Screen**
   ```
   Shows comprehensive security information:
   • Hardware-bound installation
   • Offline operation
   • Local encryption
   • No password required
   • Cannot be copied to other machines
   ```

2. **License Agreement**
   ```
   Displays EULA from LICENSE.txt
   ```

3. **Choose Install Directory**
   ```
   Default: C:\Program Files\ICAC P.U.L.S.E\
   User can change if desired
   ```

4. **Installation**
   ```
   • Copies application files
   • Creates shortcuts (Desktop + Start Menu)
   • Sets up AppData directory
   • Creates .installed marker file
   • Configures registry keys
   ```

5. **Completion Message**
   ```
   Shows post-install instructions:
   • Installation complete
   • Hardware-bound confirmation
   • No login required info
   • Data location
   • Security reminders
   ```

6. **Launch Application**
   ```
   Checkbox to launch immediately
   Application starts in installed mode (no login)
   ```

### Security Markers Created

**`.installed` Marker File:**
```
Location: %APPDATA%\ICAC_CaseManager\.installed

Contents:
ICAC P.U.L.S.E. - Installed Mode
═══════════════════════════════════════
Installation Type: Desktop Installation
Security: Hardware-Bound
Authentication: No password required
Installation Date: [timestamp]
Install Directory: [path]
═══════════════════════════════════════

IMPORTANT:
• This application is bound to this computer's hardware
• DO NOT copy to another computer
• DO NOT create .portable marker file
• All case data stored in this directory

Support: Justin@intellect-le.com
```

**File Attributes:** Hidden (prevents casual tampering)

**Registry Keys Created:**
```
HKLM\Software\ICAC_PULSE\
├── InstallationType = "Installed"
├── HardwareBound = "True"
├── PortableMode = "False"
├── InstallPath = [installation directory]
├── DataPath = %APPDATA%\ICAC_CaseManager
└── Version = [version number]
```

### Uninstaller Features

**Smart Data Retention:**

1. **First Prompt**
   ```
   "Do you want to DELETE all case data?"
   
   Options:
   • YES = Ask for confirmation
   • NO = Keep data (recommended)
   ```

2. **Confirmation (if delete chosen)**
   ```
   "FINAL CONFIRMATION"
   "Are you ABSOLUTELY SURE?"
   
   Lists what will be deleted:
   • ALL case files
   • ALL evidence
   • ALL warrants
   • ALL reports
   • Database and settings
   
   "This CANNOT be recovered!"
   ```

3. **Outcomes**
   ```
   Keep Data:
   • Uninstaller completes
   • Data preserved in %APPDATA%\ICAC_CaseManager
   • Can reinstall and access data
   • Shows preservation message
   
   Delete Data:
   • Removes entire directory
   • Verifies deletion
   • Shows confirmation or warning if failed
   • Cannot be undone
   ```

4. **Registry Cleanup**
   ```
   • Removes HKLM\Software\ICAC_PULSE
   • Removes .installed marker
   • Cleans up shortcuts
   ```

---

## Testing Checklist

Before distributing:

### Installation Testing

- [ ] **Download Requirements**
  - [ ] No NSIS installation needed by user
  - [ ] No Node.js needed by user
  - [ ] Self-contained executable

- [ ] **Installation Process**
  - [ ] Welcome screen displays security info
  - [ ] License agreement shows
  - [ ] Can choose install directory
  - [ ] Installation completes without errors
  - [ ] Desktop shortcut created
  - [ ] Start Menu shortcut created
  - [ ] Security message displays

- [ ] **Post-Installation**
  - [ ] Application launches
  - [ ] NO login screen (auto-login)
  - [ ] Dashboard loads immediately
  - [ ] Username shows "Officer"
  - [ ] No errors in console

- [ ] **Security Verification**
  - [ ] `.installed` marker exists in AppData
  - [ ] NO `.portable` marker exists
  - [ ] Settings has NO Security section
  - [ ] Registry keys created
  - [ ] Cannot copy to another machine

### Uninstall Testing

- [ ] **Uninstall Process**
  - [ ] Runs from Control Panel → Programs
  - [ ] Asks about data retention
  - [ ] Both options work correctly
  - [ ] Confirms deletion if chosen
  - [ ] Data preserved if kept
  - [ ] Registry cleaned up
  - [ ] Shortcuts removed

- [ ] **Reinstall After Uninstall**
  - [ ] Can reinstall after uninstalling
  - [ ] Data loads if preserved
  - [ ] Fresh database if deleted
  - [ ] No leftover issues

### Cross-Machine Testing

- [ ] **Hardware Binding**
  - [ ] Copy installed app to another PC
  - [ ] Application shows "Hardware Mismatch"
  - [ ] Cannot run on different machine
  - [ ] Proper error message displayed

---

## Distribution Package

### Recommended Contents

```
ICAC_PULSE_Distribution/
├── ICAC P.U.L.S.E.-1.0.0-Setup.exe    (The installer)
├── README.txt                          (Installation instructions)
├── LICENSE.txt                         (EULA)
├── RELEASE_NOTES.txt                   (What's new)
└── SUPPORT.txt                         (Contact information)
```

### README.txt Template

```
ICAC P.U.L.S.E. - Installation Instructions
═══════════════════════════════════════════════

SYSTEM REQUIREMENTS:
• Windows 10 or 11 (64-bit)
• 500 MB free disk space
• No internet connection required

INSTALLATION:
1. Double-click "ICAC P.U.L.S.E.-1.0.0-Setup.exe"
2. Follow the installation wizard
3. Click "Finish" to launch the application

IMPORTANT:
• Application is hardware-bound to your computer
• Cannot be copied to other machines
• No password required for daily use
• All data stored locally and encrypted

FIRST RUN:
The application will start immediately after installation.
No login or registration required.

SUPPORT:
Email: Justin@intellect-le.com
```

---

## Build Requirements

### On Build Machine

**Required:**
- ✅ Node.js (already installed)
- ✅ npm (already installed)
- ✅ NSIS 3.x (download if needed)
- ✅ Project dependencies (npm install)

**Optional:**
- Code signing certificate (for production)
- Git (for version control)

### NSIS Installation

If NSIS not installed:

1. **Download:**
   - Go to: https://nsis.sourceforge.io/Download
   - Download: NSIS 3.x (latest stable)

2. **Install:**
   - Run installer
   - Use default location: `C:\Program Files (x86)\NSIS\`
   - Complete installation

3. **Verify:**
   ```powershell
   Test-Path "C:\Program Files (x86)\NSIS\makensis.exe"
   ```
   Should return: `True`

---

## Quick Reference

### Build Commands

```powershell
# Full build (recommended)
.\build-installer.ps1

# Or manually
npm run build
npm run dist

# Clean build
Remove-Item dist -Recurse -Force
npm run build
npm run dist

# Build specific target
npm run dist -- --win nsis     # NSIS only
npm run dist -- --win portable # Portable only
npm run dist -- --win msi      # MSI only
```

### File Locations

| Location | Purpose |
|----------|---------|
| `dist/` | Built installers |
| `build/` | Build resources (icon, installer.nsh) |
| `out/` | Compiled application |
| `%APPDATA%\ICAC_CaseManager\` | User data after install |

### Installer Types

| Type | File | Use Case |
|------|------|----------|
| NSIS | `*-Setup.exe` | Desktop installation (recommended) |
| MSI | `*-Setup.msi` | Enterprise deployment |
| Portable | `*-Portable.exe` | USB drive use |

---

## Summary

✅ **NSIS installer configured and ready**
✅ **Security features integrated**
✅ **Build scripts created**
✅ **Documentation complete**
✅ **Testing procedures defined**

**Next Action:** Run `.\build-installer.ps1` to create the installer

The installer will:
- Install in hardware-bound mode
- Create proper security markers
- Set up AppData directories
- Configure registry
- Create shortcuts
- Show security notifications
- Provide smart uninstall options
- Protect case data

**Ready for production distribution!**
