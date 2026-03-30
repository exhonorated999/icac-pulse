# ICAC P.U.L.S.E. - Portable Build Guide

## Overview

The application now supports creating a **portable version** that can run directly from an external drive (USB drive, external SSD, network drive) without requiring installation or administrator rights.

This is ideal for:
- Law enforcement agencies with restricted IT policies
- Users without admin rights on their machines
- Running the application from different computers
- Secure, isolated deployments on encrypted drives
- Field work requiring mobile case management

## Building the Portable Version

### Command to Build Both Versions

```bash
cd H:\Workspace\icac_case_manager
npm run build
npm run dist
```

This will now create **TWO** versions in the `dist/` folder:

1. **Installer Version** (existing):
   - `ICAC P.U.L.S.E. Setup 1.0.0.exe`
   - Requires installation on the computer
   - Creates Start Menu shortcuts
   - Registers with Windows

2. **Portable Version** (new):
   - `ICAC P.U.L.S.E.-1.0.0-Portable.exe`
   - **No installation required**
   - Runs directly from any location
   - Self-contained

## Using the Portable Version

### For End Users

1. **Copy to External Drive**
   - Copy `ICAC P.U.L.S.E.-1.0.0-Portable.exe` to a USB drive or external drive
   - Example: `E:\ICAC\ICAC P.U.L.S.E.-1.0.0-Portable.exe`

2. **Run the Application**
   - Double-click the `.exe` file
   - No installation prompt - it just runs
   - Application opens immediately

3. **Data Storage**
   - On first run, the app will create a `cases/` folder in the same directory as the executable
   - All case data, database, and files are stored on the external drive
   - Example structure:
     ```
     E:\ICAC\
     ├── ICAC P.U.L.S.E.-1.0.0-Portable.exe
     ├── cases\
     │   ├── icac_cases.db
     │   ├── Case-2024-001\
     │   └── Case-2024-002\
     ```

4. **Moving Between Computers**
   - Plug the drive into any Windows computer
   - Run the `.exe` file
   - All your data is right there - no configuration needed

### Important Notes

- **No Admin Rights Required**: The portable version doesn't require administrator privileges
- **No Registry Changes**: Nothing is written to Windows registry
- **No Start Menu**: No shortcuts are created
- **Fully Isolated**: Everything runs from the drive you launch it from
- **Multiple Instances**: You can have multiple portable versions on different drives

## Deployment Strategies

### Strategy 1: USB Drive Deployment
**Use Case**: Officers working in the field

1. Copy portable `.exe` to encrypted USB drive
2. Distribute drives to officers
3. Officers plug in and run directly
4. Data stays on the drive

**Pros**: 
- Maximum portability
- Secure (encrypted drives)
- No IT involvement needed

**Cons**: 
- Drive must be present to access data
- Risk of drive loss (mitigated by encryption)

### Strategy 2: Network Drive Deployment
**Use Case**: Agency with shared network storage

1. Copy portable `.exe` to network share (e.g., `\\server\icac\`)
2. Users run directly from network
3. Each user has their own data folder

**Pros**:
- Centralized storage
- Easy updates (replace one file)
- Automatic backups (network admin handles)

**Cons**:
- Requires network connectivity
- Performance depends on network speed

### Strategy 3: External SSD Deployment
**Use Case**: Investigators with dedicated hardware

1. Use fast USB 3.0+ external SSD
2. Install portable version
3. Performance similar to local installation

**Pros**:
- Fast performance
- Large storage capacity
- Professional solution

**Cons**:
- Higher cost than USB drives

### Strategy 4: Hybrid Deployment
**Use Case**: Large agency with mixed needs

- **Installed Version**: For officers with admin rights at their desks
- **Portable Version**: For officers without admin rights or field work
- Both versions share the same data format and can open each other's cases

## Data Location Priority

The portable version determines where to store data in this order:

1. **Portable Mode** (Default): 
   - Data stored next to the `.exe` file
   - Creates `cases/` folder in same directory
   - Example: `E:\ICAC\cases\`

2. **If Write-Protected**:
   - Falls back to user's Documents folder
   - `C:\Users\[Username]\Documents\ICAC_PULSE\cases\`

This ensures the app always works, even on read-only drives.

## Updating the Portable Version

### Method 1: Replace Executable (Recommended)
1. Close the running application
2. Download new portable `.exe`
3. Replace the old `.exe` with the new one
4. **Keep the `cases/` folder** - don't delete it!
5. Run the new executable

Your data is preserved because it's in the separate `cases/` folder.

### Method 2: Side-by-Side
1. Keep both versions on the drive
2. Rename old one: `ICAC P.U.L.S.E.-1.0.0-Portable-OLD.exe`
3. Copy new one: `ICAC P.U.L.S.E.-1.1.0-Portable.exe`
4. Both will use the same `cases/` folder

## Technical Details

### How It Works

The portable build uses electron-builder's `portable` target which:
- Creates a self-extracting archive
- Extracts to a temporary folder on first run
- Uses the drive location for data storage
- Doesn't modify Windows registry
- Doesn't require elevation

### File Size
- **Installer**: ~150-200 MB
- **Portable**: ~150-200 MB (similar size)

### System Requirements
- Windows 10 or later (64-bit)
- 4 GB RAM minimum (8 GB recommended)
- 500 MB free space on drive for application
- Additional space for case data

### Security Considerations

**Recommended Setup**:
1. Use encrypted USB drives (BitLocker, VeraCrypt, hardware encryption)
2. Enable drive write-protection when not in use
3. Store portable version on agency-issued hardware only
4. Regular backups of the `cases/` folder

**Data Security**:
- The SQLite database is not encrypted by default
- Sensitive case files are stored in plain folders
- **Recommendation**: Use encrypted drives or folders
- Consider implementing the license key feature for additional security

## Building Both Versions Separately

If you want to build only specific versions:

### Build Only Installer
```bash
npm run build
npm run dist -- --win nsis
```

### Build Only Portable
```bash
npm run build
npm run dist -- --win portable
```

### Build Both (Default)
```bash
npm run build
npm run dist
```

## Distribution Checklist

When distributing the portable version:

- [ ] Build the latest version with `npm run dist`
- [ ] Test the portable `.exe` on a clean USB drive
- [ ] Verify data folder creation
- [ ] Test on a machine without admin rights
- [ ] Test creating and opening cases
- [ ] Create user documentation
- [ ] Package on encrypted drives if required
- [ ] Include Quick Start guide
- [ ] Note the version number for tracking

## Troubleshooting

### Issue: "App won't start from USB drive"
**Solution**: 
- Check drive is not write-protected
- Try running as administrator (right-click → Run as administrator)
- Ensure antivirus isn't blocking the executable

### Issue: "Can't save data"
**Solution**:
- Check drive has free space
- Ensure drive is not read-only
- Check Windows permissions on the folder

### Issue: "Slow performance"
**Solution**:
- Use USB 3.0+ drive (not USB 2.0)
- Use SSD-based external drives for better speed
- Avoid network drives over slow connections

### Issue: "Multiple computers show different data"
**Solution**:
- The portable version is designed for single-user use
- Don't run the same portable instance from multiple computers simultaneously
- For shared access, use network installation instead

## Support for Agencies

For law enforcement agencies implementing portable deployments:

**Contact your IT administrator** to:
- Configure encrypted drives
- Set up network share locations
- Establish backup procedures
- Configure antivirus exceptions if needed
- Test on your agency's computers

**Recommended Pilot Program**:
1. Deploy to 2-3 officers first
2. Gather feedback on usability
3. Refine procedures
4. Roll out agency-wide

## Configuration File

Both portable and installed versions use the same configuration format, so cases can be opened by either version without conversion.

---

## Quick Reference

**Build Command**: `npm run dist`

**Output Files**:
- `dist/ICAC P.U.L.S.E. Setup 1.0.0.exe` ← Installer
- `dist/ICAC P.U.L.S.E.-1.0.0-Portable.exe` ← Portable (NEW)

**Portable Usage**: Copy to drive → Double-click → Start working

**Data Location**: Next to the `.exe` file in `cases/` folder

**Updates**: Replace `.exe`, keep `cases/` folder

**Security**: Use encrypted drives for sensitive data
