# Portable vs Installed Storage Architecture

## Overview

The application now has **two distinct storage modes** based on how it's deployed:

1. **Portable Mode** - Data stored on the USB/external drive (truly portable)
2. **Installed Mode** - Data stored on C: drive (bound to machine)

This prevents unauthorized duplication while enabling secure portable deployments.

## Storage Locations

### Portable Mode (USB/External Drive)

**When Detected**:
- Executable name contains "Portable"
- Running from drive other than C: (D:, E:, F:, etc.)
- `portable.txt` marker file exists next to executable

**Data Location**:
```
E:\MyUSBDrive\
├── ICAC P.U.L.S.E.-1.0.0-Portable.exe  ← The application
├── portable.txt                         ← Marker file (created automatically)
└── ICAC_Data\                          ← ALL data stored here
    ├── database.db                      ← SQLite database
    ├── config.json                      ← Configuration
    └── cases\                           ← Case files
        ├── Case-2024-001\
        ├── Case-2024-002\
        └── ...
```

**Benefits**:
- ✅ Truly self-contained
- ✅ Entire USB drive can be encrypted
- ✅ Move to any computer and all data comes with it
- ✅ No C: drive access needed
- ✅ No admin rights required

### Installed Mode (C: Drive Bound)

**When Detected**:
- Installed via the NSIS installer
- Running from C:\Program Files\ or similar
- Does NOT have portable.txt marker

**Data Location**:
```
C:\Program Files\ICAC P.U.L.S.E\
└── ICAC P.U.L.S.E.exe              ← The application

C:\ProgramData\ICAC_CaseManager\    ← ALL data stored here (separate)
├── database.db                      ← SQLite database
├── config.json                      ← Configuration
└── cases\                           ← Case files
    ├── Case-2024-001\
    ├── Case-2024-002\
    └── ...
```

**Benefits**:
- ✅ Bound to C: drive (can't copy to another drive and run)
- ✅ Data in centralized location
- ✅ Standard Windows application structure
- ✅ Proper permissions and security
- ✅ Prevents unauthorized duplication

## Anti-Duplication Protection

### How It Works

**Installed Version**:
1. Application ALWAYS looks for data at `C:\ProgramData\ICAC_CaseManager\`
2. If you copy the installed .exe to a USB drive and try to run it:
   - It will still look for data on the C: drive of that computer
   - If C:\ProgramData\ICAC_CaseManager\ doesn't exist, it starts fresh
   - Original data stays on the original C: drive
3. This prevents simple copying of the application with data

**Portable Version**:
- Designed for authorized portable deployments only
- Data travels with the drive
- Should be used on encrypted drives for security
- Distribute to authorized users only

## Detection Logic

The application automatically detects which mode to run in:

```javascript
function isPortableMode(): boolean {
  // 1. Check for portable.txt marker file
  if (portableMarker exists next to .exe) {
    return true;  // Portable mode
  }
  
  // 2. Check executable name
  if (exe name contains "Portable") {
    return true;  // Portable mode
  }
  
  // 3. Check drive letter
  if (running from D:, E:, F:, etc.) {
    return true;  // Portable mode
  }
  
  // Otherwise: Installed mode
  return false;
}
```

## Building Both Versions

### Build Command
```bash
npm run build
npm run dist
```

### Output Files

**In `dist/` folder**:

1. **ICAC P.U.L.S.E. Setup 1.0.0.exe** (Installer)
   - Installs to C:\Program Files\
   - Data bound to C:\ProgramData\
   - Standard installation

2. **ICAC P.U.L.S.E.-1.0.0-Portable.exe** (Portable)
   - Runs from any drive
   - Data stored next to .exe
   - Self-contained

3. **portable.txt** (Marker - created automatically)
   - Indicates portable mode
   - Must be distributed WITH the portable .exe

## Deployment Instructions

### For Portable Deployment

1. **Build the portable version**:
   ```bash
   npm run dist
   ```

2. **Copy BOTH files to USB drive**:
   - `ICAC P.U.L.S.E.-1.0.0-Portable.exe`
   - `portable.txt`

3. **Keep them in the same folder**:
   ```
   E:\
   ├── ICAC P.U.L.S.E.-1.0.0-Portable.exe
   └── portable.txt
   ```

4. **First run creates ICAC_Data folder**:
   ```
   E:\
   ├── ICAC P.U.L.S.E.-1.0.0-Portable.exe
   ├── portable.txt
   └── ICAC_Data\  ← Created automatically
       ├── database.db
       └── cases\
   ```

5. **Recommend using encrypted drives** for security

### For Installed Deployment

1. **Build the installer**:
   ```bash
   npm run dist
   ```

2. **Distribute installer**:
   - `ICAC P.U.L.S.E. Setup 1.0.0.exe`

3. **Users run installer**:
   - Installs to C:\Program Files\
   - Creates data folder at C:\ProgramData\ICAC_CaseManager\
   - Creates Start Menu shortcuts

4. **Data is bound to C: drive**:
   - Cannot be duplicated by simply copying files
   - Each installation is independent

## Security Implications

### Portable Version
**Pros**:
- Entire drive can be encrypted (BitLocker, VeraCrypt)
- No data left on host computer
- Secure for field work

**Cons**:
- Physical drive must be secured
- Drive loss = data loss (unless backed up)
- Can be duplicated if not encrypted

**Recommendation**: 
- Use encrypted USB drives only
- Implement access controls
- Regular backups

### Installed Version
**Pros**:
- Bound to specific machine's C: drive
- Cannot easily duplicate with data
- Standard Windows security applies
- Centralized backup strategies

**Cons**:
- Data remains on C: drive even after uninstall (unless deleted)
- Requires proper machine security

**Recommendation**:
- Use on secured workstations
- Implement hardware ID licensing (already available in codebase)
- Regular system backups

## Migration Between Modes

### From Installed to Portable
1. On installed machine: Copy `C:\ProgramData\ICAC_CaseManager\cases\` folder
2. Copy to USB drive: `E:\ICAC_Data\cases\`
3. Copy database: `C:\ProgramData\ICAC_CaseManager\database.db` → `E:\ICAC_Data\database.db`
4. Run portable version from USB drive

### From Portable to Installed
1. On portable drive: Copy `E:\ICAC_Data\cases\` folder
2. Install application on machine
3. Copy to installed location: `C:\ProgramData\ICAC_CaseManager\cases\`
4. Copy database: `E:\ICAC_Data\database.db` → `C:\ProgramData\ICAC_CaseManager\database.db`
5. Run installed version

**Note**: Migration requires manual file copying. Not automatic.

## Testing

### Test Portable Mode
1. Build portable version
2. Copy `.exe` and `portable.txt` to USB drive
3. Run from USB drive
4. Create a test case
5. Check that `ICAC_Data` folder was created ON THE USB DRIVE
6. Verify database and case files are on USB drive
7. Unplug USB drive
8. Plug into different computer
9. Run again - should see same data

### Test Installed Mode
1. Build installer
2. Install on machine (e.g., Computer A)
3. Create a test case
4. Verify data is at `C:\ProgramData\ICAC_CaseManager\`
5. Copy the installed `.exe` to USB drive (without data)
6. Take USB to different machine (Computer B)
7. Run the copied `.exe` from USB on Computer B
8. Should NOT see the data from Computer A
9. Should create fresh data on Computer B's C: drive

## Troubleshooting

### Issue: Portable version still using C: drive
**Solution**:
- Ensure `portable.txt` file is present next to the `.exe`
- Check console logs for "Running in PORTABLE mode" message
- Verify executable name contains "Portable"

### Issue: Installed version creating data on USB drive
**Solution**:
- Remove any `portable.txt` file from installation directory
- Reinstall using the proper installer
- Verify installed location is on C: drive

### Issue: Can't write to drive
**Solution**:
- Check drive is not write-protected
- Verify user has write permissions
- Ensure drive has free space

### Issue: Data not found after moving drives
**Portable Version**:
- Ensure `ICAC_Data` folder moved WITH the executable
- Check all files copied correctly

**Installed Version**:
- This is expected behavior - data is bound to C: drive
- Each machine has independent data

## Console Logging

The application logs which mode it's running in:

**Portable Mode**:
```
Running in PORTABLE mode. Data path: E:\ICAC_Data
```

**Installed Mode**:
```
Running in INSTALLED mode. Data path: C:\ProgramData\ICAC_CaseManager
```

Check console (F12 → Console) to verify correct mode.

## Summary

| Feature | Portable Mode | Installed Mode |
|---------|---------------|----------------|
| **Storage Location** | Next to .exe on USB/external drive | C:\ProgramData\ (fixed) |
| **Data Portability** | ✅ Moves with drive | ❌ Bound to C: drive |
| **Admin Rights** | ❌ Not required | ✅ Required for install |
| **Anti-Duplication** | Via encryption | Via C: drive binding |
| **Use Case** | Field work, restricted IT | Office workstations |
| **Distribution** | .exe + portable.txt | Installer only |
| **Detection** | Automatic | Automatic |

Both modes provide security through different mechanisms - portable via encryption, installed via drive binding.
