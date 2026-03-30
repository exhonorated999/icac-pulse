# Implementation Notes

## Recent Changes

### 3. Dashboard Overhaul (2025-11-26)

Complete redesign of the Dashboard with interactive statistics and case management.

**New Features:**

1. **Interactive Case Status Statistics**
   - Overall Cases - Shows all cases
   - Active Cases - Shows cases with status 'open'
   - Arrests - Shows cases with status 'arrest'
   - Closed - Shows cases with status 'closed_no_arrest'
   - Transferred - Shows cases with status 'referred'
   - Waiting on E.S.P. Warrants - Shows cases with status 'warrants_issued'
   - Ready for Residential - Shows cases with status 'ready_residential'

2. **Interactive Case Type Categories**
   - CyberTip cases
   - Peer 2 Peer cases
   - Chat cases
   - Other cases

3. **Clickable Overdue Warrant Alerts**
   - Prominent pink alert box at top of dashboard
   - Each overdue warrant is clickable
   - Clicking navigates directly to case detail → warrants tab
   - Shows: Company name, Case number, Due date, Days overdue

4. **Filtered Cases View**
   - Clicking any stat shows filtered cases list
   - Displays: Case icon, Case number, Type, Status, Created date
   - Each case has "View Case" and "Delete" buttons
   - Close button to dismiss filtered view

5. **Case Deletion Feature**
   - Delete button available in filtered cases view
   - Two-step confirmation process:
     - Warning dialog explaining data loss
     - Prompt requiring case number entry
   - Deletes all associated data:
     - Database records
     - Evidence files
     - Warrant files
     - Suspect photos
     - All related records
   - Intended for training/sample cases only
   - Strongly recommends export before deletion

**Files Modified:**
- `src/renderer/pages/Dashboard.tsx` - Complete rewrite with interactive features
- `src/renderer/pages/CaseDetail.tsx` - Added support for ?tab= query parameter

**User Workflow:**

1. **View Statistics:**
   - Dashboard loads with all statistics displayed
   - Overdue warrants appear prominently if any exist

2. **Click Statistic:**
   - Click any stat card (e.g., "Arrests", "CyberTip")
   - Filtered cases list appears below
   - Shows all matching cases

3. **Navigate to Case:**
   - Click "View Case" button to open case detail
   - Click overdue warrant to jump to warrants tab

4. **Delete Case:**
   - Click "Delete" button in filtered view
   - Read warning dialog
   - Type case number to confirm
   - Case and all data permanently deleted

**Visual Design:**
- 7-column grid for status statistics (responsive)
- 4-column grid for case type statistics
- Color-coded stats (green=active, pink=arrests, yellow=waiting, etc.)
- Hover effects show interactivity
- Animated pulse on overdue warrant alert

---

## Recent Changes

### 1. Case Status Updates (2025-11-26)

Added two new status options to the case workflow:

**New Status Options:**
- **🟡 Warrants Issued** - Yellow color, indicates warrants have been sent to companies
- **🔵 Ready for Residential** - Cyan color, indicates case is ready for residential search warrant execution

**Database Changes:**
- Updated status CHECK constraint to use 'warrants_issued' instead of 'waiting_warrants'
- Migration automatically updates existing data
- Recreates cases table with correct constraint

**Files Modified:**
- `src/renderer/pages/CaseDetail.tsx` - Updated status colors, labels, and dropdown
- `src/renderer/pages/CasesList.tsx` - Updated status colors and labels for list view
- `src/main/database.ts` - Updated CHECK constraint and added migration

**Status Flow:**
1. 🟢 Open - Initial case state
2. 🟡 Warrants Issued - Warrants sent to companies (NEW)
3. 🔵 Ready for Residential - Ready to execute at residence (NEW)
4. 🔴 Arrested - Suspect arrested
5. ⚫ Closed - Case closed without arrest
6. 🔵 Transferred - Referred to another agency

**Migration Details:**
- Automatically runs on app startup
- Updates old 'waiting_warrants' status to 'warrants_issued'
- Recreates table with new constraint
- Preserves all data and relationships
- Safe to run multiple times

---

### 2. CyberTip NCMEC Folder Upload (2025-11-26)

Implemented structured NCMEC folder upload with metadata tracking in CyberTip cases.

**Features:**
- Upload entire NCMEC folders (not just individual files)
- Track NCMEC-provided filename/folder name
- Document CSAM description for each folder
- View uploaded folders in Windows Explorer
- Delete records (folders remain in file system)

**Database Changes:**
Added three new columns to `cybertip_files` table:
- `file_path` TEXT - Relative path to uploaded folder
- `ncmec_filename` TEXT - NCMEC-provided name
- `csam_description` TEXT - Content description

**Files Modified:**
- `src/main/database.ts` - Added migration for new columns
- `src/main/index.ts` - Updated IPC handlers for save/delete
- `src/shared/types.ts` - Added DELETE_CYBERTIP_FILE channel
- `src/preload/index.ts` - Exposed deleteCyberTipFile function
- `src/renderer/pages/CaseDetail.tsx` - Complete UI implementation

**User Workflow:**
1. Enter NCMEC-provided filename/folder name
2. Enter CSAM description (required)
3. Click "Upload NCMEC Folder"
4. Select entire NCMEC folder from file system
5. Folder copies to case's `cybertip/` directory
6. Record saved to database with metadata
7. Can view folder in Explorer or delete record

**UI Location:**
- CyberTip cases only
- Overview tab
- "NCMEC Files" section
- Form always visible (not in edit mode)
- Follows established upload patterns (warrants, evidence)

---

## Testing Checklist

### Status Changes
- [ ] Status dropdown shows all 6 options
- [ ] Status updates immediately on change
- [ ] Status colors display correctly
- [ ] Status appears correctly in cases list
- [ ] All case types can use new statuses

### NCMEC Folder Upload
- [ ] Form validation works (both fields required)
- [ ] Folder dialog opens correctly
- [ ] Entire folder structure copies correctly
- [ ] Metadata saves to database
- [ ] Files list displays uploaded folders
- [ ] "Open in Explorer" button works
- [ ] Delete confirmation appears
- [ ] Delete removes record but keeps folder
- [ ] Focus restores after upload
- [ ] Works on fresh case and existing case

---

## Known Considerations

### NCMEC Folder Upload
- Each database record represents one uploaded folder
- Delete removes database record only - folder remains in file system
- Officers must manually manage actual files in `cybertip/` folder if needed
- "View CyberTip Folder" button at bottom opens entire cybertip directory
- Individual folder "Open in Explorer" opens specific uploaded folder

### Status System
- Lower priority numbers = higher urgency (law enforcement standard)
- Status can be changed at any time (not locked to edit mode)
- Updates happen immediately via IPC call
- No validation on status transitions (officers decide workflow)

---

## Database Schema

### cybertip_files Table
```sql
CREATE TABLE IF NOT EXISTS cybertip_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL,
  filename TEXT,                    -- Legacy field
  ip_address TEXT,                  -- Legacy field
  datetime TEXT,                    -- Legacy field
  officer_description TEXT,         -- Legacy field
  file_path TEXT,                   -- NEW: Relative path to folder
  ncmec_filename TEXT,              -- NEW: NCMEC-provided name
  csam_description TEXT,            -- NEW: Content description
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);
```

### Migration Strategy
- Migrations run automatically on app startup
- Safe to run multiple times (checks for column existence)
- Preserves all existing data
- New columns default to NULL for existing records
