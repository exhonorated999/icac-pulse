# Storage Migration Feature

## Overview
Added functionality to allow users to change the case files storage location and migrate existing case files to a new drive/location.

## Use Case
When investigators' desktop drives are running low on space due to large evidence files and warrant returns, they can now move all case files to an external drive or different volume without losing any data.

## Features Implemented

### 1. **Dynamic Storage Path Configuration**
- Storage location is now configurable via `config.json`
- Default location remains in AppData if no custom path is set
- Path is validated on each application startup

### 2. **Storage Location Change UI** (Settings Page)
- New "Change Location" button in Settings
- Visual warning about storage relocation
- Dialog to select new storage location
- Option to migrate existing files or just change path for new cases

### 3. **Case Files Migration**
- Copies all case folders from old location to new location
- Real-time progress tracking with:
  - Percentage complete
  - Current folder being copied
  - Current file being copied
  - Folders completed / Total folders
- Progress dialog with animated loading indicator
- Original files remain intact until migration is confirmed successful

### 4. **Validation & Safety**
- Validates new path exists and is writable
- Checks write permissions before migration
- Error handling for failed copies
- User confirmation before starting migration

## Modified Files

### Backend Changes:
1. **src/main/database.ts**
   - Modified `getCasesPath()` to read from config.json
   - Added `setCasesPath()` to update config.json

2. **src/main/index.ts**
   - Added `CHANGE_CASES_PATH` IPC handler
   - Added `MIGRATE_CASE_FILES` IPC handler  
   - Added helper functions:
     - `countFiles()` - Counts total files for progress calculation
     - `copyDirectoryRecursive()` - Copies directories with progress callbacks

3. **src/shared/types.ts**
   - Added `CHANGE_CASES_PATH` to IPC_CHANNELS
   - Added `MIGRATE_CASE_FILES` to IPC_CHANNELS

4. **src/preload/index.ts**
   - Exposed `changeCasesPath()` method
   - Exposed `migrateCaseFiles()` method
   - Added `onMigrationProgress()` listener
   - Added `removeMigrationProgressListener()` method

### Frontend Changes:
1. **src/renderer/pages/Settings.tsx**
   - Added "Change Location" button
   - Added migration progress dialog
   - Added `handleChangeStorageLocation()` function
   - Added state management for migration progress
   - Added informational notice about storage relocation

## User Workflow

### Scenario 1: Migration with existing cases
1. User clicks "Change Location" in Settings
2. Selects new drive/folder (e.g., E:\ICAC_Cases)
3. Confirms they want to migrate existing files
4. Progress dialog shows real-time migration status
5. Upon completion, all case files are in new location
6. App automatically uses new location going forward

### Scenario 2: Change location only (no migration)
1. User clicks "Change Location" in Settings
2. Selects new drive/folder
3. Declines migration option
4. New cases created after this point go to new location
5. Old cases remain accessible at original location

## Configuration File

**Location:** `%AppData%/ICAC_CaseManager/config.json`

**Format:**
```json
{
  "casesPath": "E:\\ICAC_Cases"
}
```

## Technical Details

### Progress Tracking
- Uses IPC event `migration-progress` to send updates from main to renderer
- Calculates percentage based on files copied vs total files
- Updates in real-time as each file is copied

### File Copy Strategy
- Uses synchronous `fs.copyFileSync()` for reliability
- Maintains directory structure
- Preserves file attributes and timestamps
- Handles nested directories recursively

### Error Handling
- Validates path exists before migration
- Tests write permissions with temp file
- Wraps operations in try-catch blocks
- User-friendly error messages

## Testing Recommendations

1. **Test with small dataset first**
   - Create a few test cases with small files
   - Test migration to ensure it works
   - Verify files copied correctly

2. **Test permissions**
   - Try selecting read-only folder (should fail gracefully)
   - Try selecting network drive
   - Try selecting external USB drive

3. **Test interruption handling**
   - What happens if drive disconnects during migration?
   - What happens if app crashes during migration?

4. **Test with large datasets**
   - Multiple GB of evidence files
   - Hundreds of case folders
   - Monitor memory usage

## Future Enhancements

Potential improvements for future versions:

1. **Resume capability** - Save progress and resume if interrupted
2. **Delete old files option** - After successful migration, offer to delete originals
3. **Compression option** - Compress old cases to save space
4. **Network drive support** - Better handling of UNC paths
5. **Disk space check** - Verify destination has enough space before starting
6. **Backup before migration** - Create zip backup of old location
7. **Selective migration** - Choose specific cases to migrate
8. **Schedule migration** - Run migration overnight or at specific time

## Notes

- Original files are NOT deleted automatically after migration
- Users should manually verify migration completed successfully before deleting old files
- Migration can take significant time for large case loads (hundreds of GB)
- Progress dialog cannot be closed during active migration
- Network drives may be slower for migration

## Build Information

After implementing these changes, rebuild the application:

```bash
cd H:\Workspace\icac_case_manager
npm run build
npm run dist
```

The new installer will include the storage migration feature.
