# Build Commands Reference

## Production Builds

### Build Both Installer + Portable Version (Recommended)
```bash
cd H:\Workspace\icac_case_manager
npm run build
npm run dist
```

**Output Files** (in `dist/` folder):
- ✅ `ICAC P.U.L.S.E. Setup 1.0.0.exe` - Standard installer (requires installation)
- ✅ `ICAC P.U.L.S.E.-1.0.0-Portable.exe` - Portable version (runs from external drive)

---

## Alternative Build Options

### Build Only Installer (NSIS)
```bash
npm run build
npm run dist -- --win nsis
```

### Build Only Portable Version
```bash
npm run build
npm run dist -- --win portable
```

### Quick Build (Combines build + dist)
```bash
npm run package
```

---

## Development/Testing

### Development Mode (Hot Reload)
```bash
npm run dev
```

### Build Without Creating Installer
```bash
npm run build
```

---

## Using Build Scripts

### Windows Batch File
```bash
build-installer.bat
```

### PowerShell Script
```powershell
.\build-installer.ps1
```

---

## What Each Build Type Does

| Build Type | File Name | Installation Required | Admin Rights | Use Case |
|------------|-----------|----------------------|--------------|----------|
| **NSIS Installer** | `Setup 1.0.0.exe` | ✅ Yes | ✅ Yes | Desktop installations, agency-wide deployments |
| **Portable** | `1.0.0-Portable.exe` | ❌ No | ❌ No | USB drives, field work, restricted environments |

---

## Deployment Scenarios

### Scenario 1: Standard Agency Deployment
**Use**: NSIS Installer
```bash
npm run dist -- --win nsis
```
Deploy `ICAC P.U.L.S.E. Setup 1.0.0.exe` to workstations.

### Scenario 2: Field Officers with USB Drives
**Use**: Portable Version
```bash
npm run dist -- --win portable
```
Copy `ICAC P.U.L.S.E.-1.0.0-Portable.exe` to encrypted USB drives.

### Scenario 3: Mixed Environment
**Use**: Both
```bash
npm run dist
```
Distribute both versions based on officer needs.

---

## After Building

### Installer Version (NSIS)
1. Run `ICAC P.U.L.S.E. Setup 1.0.0.exe` on target computer
2. Follow installation wizard
3. Application installs to `C:\Program Files\ICAC P.U.L.S.E.\`
4. Creates Start Menu shortcuts
5. Data stored in user-selected location (default: Documents)

### Portable Version
1. Copy `ICAC P.U.L.S.E.-1.0.0-Portable.exe` to USB/external drive
2. Double-click to run (no installation)
3. Application runs directly from drive
4. Data stored next to `.exe` in `cases/` folder
5. No shortcuts or registry entries created

---

## Typical Workflow

### For Regular Updates
```bash
# 1. Make your code changes
# 2. Test in development
npm run dev

# 3. Build production versions
npm run build

# 4. Create installers
npm run dist

# 5. Test both versions
# - Test NSIS installer on clean VM
# - Test portable on USB drive

# 6. Distribute
# - Upload to agency server
# - Copy to USB drives
# - Email download links
```

---

## Quick Distribution Checklist

- [ ] Run `npm run dist`
- [ ] Check `dist/` folder for both files
- [ ] Test installer on clean machine
- [ ] Test portable on USB drive
- [ ] Verify version number is correct
- [ ] Create release notes
- [ ] Distribute to users

---

## File Sizes (Approximate)

- **Installer**: ~150-200 MB
- **Portable**: ~150-200 MB
- Both are similar size because they contain the full application

---

## Troubleshooting Build Issues

### Issue: Build fails
```bash
# Clean and rebuild
npm run build -- --clean
npm run dist
```

### Issue: Antivirus blocks portable version
- Add exclusion for `dist/` folder
- Sign the executable (requires code signing certificate)

### Issue: Need to rebuild without cache
```bash
# Delete build artifacts
rmdir /s /q out
rmdir /s /q dist
rmdir /s /q dist-electron

# Rebuild
npm run build
npm run dist
```

---

## Next Steps After Building

1. **Installer Version**:
   - Store on network share for IT department
   - Document installation instructions
   - Test on various Windows versions

2. **Portable Version**:
   - Copy to multiple USB drives
   - Test on machines without admin rights
   - Create user quick-start guide
   - Consider encrypted drives for security

---

## Version Naming

The version number comes from `package.json`:
```json
{
  "version": "1.0.0"
}
```

To change version for next release:
1. Edit `package.json`
2. Update version: `"version": "1.1.0"`
3. Rebuild: `npm run dist`
4. New files will have updated version numbers
