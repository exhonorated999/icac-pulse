# Database Reset Instructions

## Data Loss Issue

The database migration (Migration 7) that updated the status CHECK constraint was too aggressive and may have caused data loss during the table recreation process.

## How to Start Fresh

### Option 1: Delete Database File (Recommended)

1. **Close the application** completely
2. Navigate to: `%APPDATA%\ICAC_CaseManager\`
   - Press `Win + R`
   - Type: `%APPDATA%\ICAC_CaseManager\`
   - Press Enter
3. **Delete** the `database.db` file
4. **Keep** the `cases` folder (if you want to preserve any manually saved files)
5. **Restart the application**
6. The app will create a fresh database with correct schema

### Option 2: Full Reset (Nuclear Option)

If you want to completely start over:

1. **Close the application** completely
2. Navigate to: `%APPDATA%\ICAC_CaseManager\`
3. **Delete the entire folder**
4. **Restart the application**
5. Register with your username again
6. Fresh start with correct database schema

## What Will Happen After Reset

### After Deleting Database Only:
- ✅ User registration preserved (hardware binding)
- ✅ Case files preserved in `cases` folder
- ❌ Database records lost (cases, notes, warrants metadata)
- ✅ New database with correct schema

### After Full Reset:
- ❌ Everything deleted
- ✅ Clean slate
- ✅ Will ask for registration again
- ✅ Hardware binding will occur again

## Preventing Future Issues

### The migration has been improved to be safer:

We should update Migration 7 to be more careful. Let me provide a safer version.

## Testing New Database

After reset, test:
1. Create a sample CyberTip case
2. Add some notes
3. Test all status options
4. Verify status dropdown shows all 6 options
5. Close and reopen app - data should persist

## Backup Recommendations

Going forward, you can manually backup your database:

### Manual Backup
1. Navigate to: `%APPDATA%\ICAC_CaseManager\`
2. Copy `database.db` to a safe location
3. Label with date: `database_backup_2024-11-26.db`
4. Store securely (encrypted USB recommended)

### When to Backup
- Before testing new features
- Before major updates
- Weekly for active investigations
- Before exporting cases

## Recovery (If Backup Exists)

If you have a backup:
1. Close application
2. Navigate to: `%APPDATA%\ICAC_CaseManager\`
3. Delete current `database.db`
4. Copy your backup file
5. Rename to `database.db`
6. Restart application

## Creating Sample Data

After reset, quickly create sample data:

### Sample CyberTip Case
1. Click "Create Case"
2. Select "CyberTip"
3. Fill in:
   - Case Number: 2024-TEST-001
   - CyberTip Number: 12345678
   - Report Date: Today
   - Reporting Company: Facebook
   - Priority: 2
4. Add identifier: Email = test@example.com
5. Save case

### Sample P2P Case
1. Click "Create Case"
2. Select "P2P"
3. Fill in:
   - Case Number: 2024-TEST-002
   - Download Date: Today
   - Platform: BitTorrent
   - Suspect IP: 192.168.1.100
   - Provider: Comcast
4. Save case

### Add Sample Notes
1. Open a case
2. Go to Notes tab
3. Add note: "Initial investigation started"
4. Add note: "Warrants sent to Facebook"
5. Verify notes appear

### Test Status Changes
1. Open a case
2. Change status to each option:
   - Open
   - Warrants Issued
   - Ready for Residential
   - Arrested
   - Closed
   - Transferred
3. Verify changes save immediately

## Sorry for the Inconvenience

This data loss was caused by an aggressive database migration strategy. In production software, migrations should be:
- Non-destructive when possible
- Backed up before running
- Tested on sample data first
- Reversible if needed

For future updates, we'll use safer migration patterns.

## Need Help?

If you encounter issues after reset:
1. Check console logs for migration errors
2. Verify database file exists
3. Check file permissions
4. Ensure %APPDATA% is writable
