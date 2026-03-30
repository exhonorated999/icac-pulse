# ICAC P.U.L.S.E. Project Rules

## Project Overview
ICAC P.U.L.S.E. is an offline-only desktop application for managing Internet Crimes Against Children cases. The software is strictly local, hardware-bound, and designed for sensitive law enforcement use.

## Critical Security Requirements

### Offline-Only Operation
- **NO cloud storage or backup services** - all data stays on local machine
- **NO network requests** except during initial npm install
- **NO telemetry or analytics** - zero external communication
- All case data stored in: `%APPDATA%\ICAC_CaseManager\`

### Hardware-Bound Licensing
- Application binds to machine hardware on first registration using `node-machine-id`
- Database encrypted with hardware-derived key
- If copied to another machine, app will refuse to run (shows "Hardware Mismatch" error)
- Implementation: `src/main/hardware.ts`

## Technology Stack

### Core Technologies
- **Electron** - Desktop application framework
- **React 18 + TypeScript** - UI layer with React Router for navigation
- **sql.js** - Pure JavaScript SQLite (no compilation needed)
- **Vite** - Build tool with electron plugin
- **Tailwind CSS** - Styling with custom Neon Midnight theme

### Why sql.js Instead of better-sqlite3
- `better-sqlite3` requires Visual Studio Build Tools compilation on Windows
- `sql.js` is pure JavaScript, works immediately without compilation
- **Trade-off:** sql.js is in-memory, requires explicit `saveDatabase()` calls after writes

## Critical sql.js Patterns

### ALWAYS Convert undefined to null
```typescript
// CORRECT - sql.js cannot handle undefined
stmt.run(
  data.field1 || null,
  data.field2 || null,
  data.optionalField || null  // MUST convert undefined to null
);

// WRONG - will throw "tried to bind a value of an unknown type (undefined)"
stmt.run(data.field1, data.field2, data.optionalField);
```

### lastInsertRowid Returns 0 - Use Workaround
```typescript
// WRONG - lastInsertRowid returns 0 with sql.js
const result = stmt.run(...);
const id = result.lastInsertRowid; // Returns 0!

// CORRECT - Query by unique field instead
stmt.run(caseData.caseNumber, ...);
const verifyStmt = db.prepare('SELECT * FROM cases WHERE case_number = ?');
const verifyResult = verifyStmt.get(caseData.caseNumber);
const caseId = verifyResult.id; // Actual ID
```

### Database Wrapper Pattern
```typescript
// We use DBWrapper to make sql.js work like better-sqlite3
const db = getDatabase(); // Returns DBWrapper instance

// Supports prepare().run(), prepare().get(), prepare().all()
const stmt = db.prepare('INSERT INTO users (name) VALUES (?)');
stmt.run('John'); // Automatically calls saveDatabase()

const result = db.prepare('SELECT * FROM users WHERE id = ?').get(1);
const all = db.prepare('SELECT * FROM users').all();
```

### Always Call saveDatabase() After Writes
```typescript
// The wrapper does this automatically in run()
// But if using db.exec() directly:
db.run('INSERT INTO table VALUES (?)', [value]);
saveDatabase(); // REQUIRED - sql.js is in-memory
```

## Database Migrations

### Migration Best Practices
```typescript
// ALWAYS use safe migration patterns
function runMigrations(): void {
  // Check if column exists before adding
  const columns = db.exec("PRAGMA table_info(table_name)");
  const columnNames = columns[0].values.map(row => row[1]);
  
  if (!columnNames.includes('new_column')) {
    db.run('ALTER TABLE table_name ADD COLUMN new_column TEXT');
  }
  
  // For CHECK constraint changes, disable foreign keys
  db.run('PRAGMA foreign_keys = OFF');
  // ... recreate table ...
  db.run('PRAGMA foreign_keys = ON');
  
  // ALWAYS save after migration
  saveDatabase();
}
```

### Adding Columns to Existing Tables
```typescript
// NEVER alter CREATE TABLE statements for existing databases
// ALWAYS use migrations in runMigrations() function
// Check before adding to prevent duplicate column errors
// Use ALTER TABLE ADD COLUMN when possible
```

### Table Recreations (Last Resort)
```typescript
// When CHECK constraints need changing:
// 1. Disable foreign keys
// 2. Create new table with correct constraint
// 3. Copy all data
// 4. Drop old table
// 5. Rename new table
// 6. Recreate indexes
// 7. Re-enable foreign keys
// 8. Save database
```

### Migration Principles
- Migrations run automatically on app startup
- Safe to run multiple times (check before adding)
- Preserves all existing data
- Add new migrations to `runMigrations()` in `database.ts`
- Always include error handling
- Log all migration steps

## UI/UX Design

### Color Scheme: Neon Midnight (Cyberpunk Theme)
```javascript
colors: {
  background: '#0B1120',      // Very dark navy
  panel: '#121A2C',           // Secondary panels
  text: {
    primary: '#E0E0FF',       // Soft off-white with blue tint
    muted: '#94A3C0',         // Muted text
  },
  accent: {
    cyan: '#00D4FF',          // Primary accent (bright cyan)
    pink: '#FF2A6D',          // Secondary accent (hot pink - alerts/highlights)
  },
  status: {
    success: '#39FFA0',       // Success messages
    warning: '#FFB800',       // Warnings
  }
}
```

### Design Guidelines
- Follow Apple's design guidelines for clean, professional UI
- Use cyan (`#00D4FF`) for primary actions and highlights
- Use pink (`#FF2A6D`) for critical alerts and delete actions
- Custom cyan scrollbars for consistency
- Dark theme optimized for extended use
- Light mode toggle available in Settings (requires CSS implementation)

## Case Management Structure

### Case Status System - Six Workflow Stages

**Complete Workflow:**
1. **🟢 Open** (`open`) - Initial case state, active investigation
2. **🟡 Warrants Issued** (`warrants_issued`) - ESPs served warrants, awaiting data returns
3. **🔵 Ready for Residential** (`ready_residential`) - Ready to execute residential search warrant
4. **🔴 Arrested** (`arrest`) - Suspect arrested
5. **⚫ Closed** (`closed_no_arrest`) - Case closed without arrest
6. **🔵 Transferred** (`referred`) - Referred to another agency

**Status Colors:**
- Green: Active/Open
- Yellow: Waiting on warrants
- Cyan: Ready for action, Transferred
- Pink: Arrested (critical milestone)
- Gray: Closed

**Status Updates:**
- Editable dropdown (always available, not just in edit mode)
- Updates immediately via `updateCase` IPC call
- Use functional setState pattern to avoid stale closures:
```typescript
setCaseData(prevData => {
  if (!prevData) return prevData;
  return { ...prevData, status: newStatus };
});
```

### Four Case Types - All Fully Implemented ✅

#### 1. CyberTip
- NCMEC CyberTipline report investigations
- **Overview Fields:**
  - CyberTipline Report Number
  - Priority Level (1/2/3/E)
  - Reporting Company
  - Report Date
  - Occurrence Date
  - Date Received UTC
  - Identifiers (email, username, IP, phone, userid, name)
  - NCMEC file metadata
- **Special Features:**
  - NCMEC PDF auto-parsing
  - Platform tracking for usernames
  - Provider tracking for IP addresses
  - NCMEC folder upload with metadata tracking

#### 2. P2P (Peer-to-Peer)
- File sharing investigations
- **Overview Fields:**
  - Download Date
  - Network Platform (BitTorrent, Shareazza, IRC, Freenet, Other)
  - Suspect IP Address
  - ISP Provider
  - Download Folder (upload/view buttons always available)
- **Special Features:**
  - Download folder upload works like warrants (always available)
  - Immediate database save on folder upload
  - View folder button opens in Explorer

#### 3. Chat
- Undercover chat operations
- **Overview Fields:**
  - Date Chat Started
  - Platform (Discord, Snapchat, Instagram, etc.)
  - Usernames (multiple, managed dynamically)
- **Special Features:**
  - Add/remove usernames in edit mode
  - Username pills display in view mode
  - JSON storage for username arrays

#### 4. Other
- General investigation cases
- **Overview Fields:**
  - Case Number
  - Synopsis (textarea for description)
- **Special Features:**
  - Simplest case type
  - Flexible synopsis field
  - Perfect for non-standard investigations

### Priority Level System (CyberTip Cases)
- **Priority Level 1** - High/Immediate (pink color)
- **Priority Level 2** - Medium (yellow/warning color)
- **Priority Level 3** - Low (green color)
- **Priority Level E** - Electronic (cyan color)

**Note:** Lower numbers = higher urgency (standard law enforcement convention)

### Universal Tab Structure
All case types share the same tab structure:

1. **📋 Overview** - Case-specific information (varies by type)
2. **📝 Notes** - Case notes and updates (standalone tab)
3. **📦 Evidence** - Evidence file/folder management
4. **⚖️ Warrants** - Search warrant tracking
5. **👤 Suspect** - Suspect profile with photos
6. **🎯 OP Plan** - Operations planning
7. **📄 Report** - Case report with PDF export
8. **⚔️ Prosecution** - Prosecution tracking

### Shared Components (All Case Types)

#### Notes Tab
- **Always-on textarea** for adding notes
- Ctrl+Enter shortcut to save quickly
- Chronological list (newest first)
- Timestamp display
- Delete with confirmation
- **Removed from Overview** to its own dedicated tab

#### Evidence Tab
- Upload files or folders with description
- Multiple file/folder selection supported
- View button opens in Explorer
- Delete removes record (keeps file)
- Stored in `evidence` folder under case directory
- Use cases: cell phone extractions, triage reports, forensic analysis

#### Warrants Tab
- Upload warrant PDFs with naming: `{CompanyName}_{Date}_warrant.pdf`
- Upload warrant returns (files/folders) to: `{CompanyName}_{Date}_return/`
- "View PDF" and "View Returns" buttons open in Explorer
- **Upload buttons always available** (outside edit mode)
- Due date tracking with overdue alerts (pink)

#### Suspect Tab
**Profile Fields:**
- First Name, Last Name, DOB, Phone, Address, Place of Work
- Vehicle: Make, Model, Color
- Weapons Registry (checkbox + list)

**Photos:** Three categories with actual image display
- Suspect Photos (4 column grid)
- Vehicle Photos (4 column grid)
- Residence Photos (6 column grid, smaller thumbnails)

#### OP Plan Tab
- Simple PDF upload/view
- Upload button changes to "Replace PDF" after upload
- "View PDF" opens in Explorer
- Stores to `operations_plan/ops_plan.pdf`

#### Report Tab
**Implementation:** Simple textarea (NOT rich text editor)
- **Font:** Arial, 14px (default)
- **Always editable** - no edit mode toggle
- **Spell check:** Enabled via browser
- **Buttons:** "Save Report" and "Download PDF"

**PDF Export Features:**
- **Header:** "ICAC Case Report" + Case Number
- **Footer:** 
  - Left: "Prepared by: {Officer Name}"
  - Right: "{Date} at {Time}"
- Auto-opens folder after export
- Filename: `Case_{CaseNumber}_Report.pdf`

#### Prosecution Tab
**Fields:**
- Court Case Number
- District Attorney Assigned
- Charges Filed (textarea)
- Convicted (checkbox)
- Sentence (textarea, only shown if convicted)

**Features:**
- Edit/View mode pattern
- Empty state message
- All fields optional

### NCMEC File Upload Feature (CyberTip Cases)

**Purpose:** Track NCMEC-provided files/folders with metadata

**Database Schema:**
```sql
ALTER TABLE cybertip_files ADD COLUMN file_path TEXT;
ALTER TABLE cybertip_files ADD COLUMN ncmec_filename TEXT;
ALTER TABLE cybertip_files ADD COLUMN csam_description TEXT;
```

**UI Components:**
- NCMEC Filename input (required)
- CSAM Description textarea (required)
- "Upload NCMEC Folder" button
- Files list with metadata display
- "Open in Explorer" per file
- Delete button (removes record, keeps folder)

**Upload Pattern:**
```typescript
// 1. User enters filename and description
// 2. Clicks Upload NCMEC Folder
// 3. Folder dialog opens (openDirectory)
// 4. Folder copies to cases/[CaseNumber]/cybertip/
// 5. Metadata saves to database
// 6. Appears in list immediately
```

**Best Practices:**
- Always outside edit mode (like warrant uploads)
- Immediate database save
- Focus restoration after upload
- Clear error messages

### CyberTip Identifier Requirements

#### Username Identifiers - MUST Include Platform
```typescript
// REQUIRED: When type is 'username', platform is mandatory
{
  identifier_type: 'username',
  identifier_value: 'john_doe_123',
  platform: 'Facebook' // REQUIRED - which platform
}
```

#### IP Address Identifiers - MUST Include Provider
```typescript
// REQUIRED: When type is 'ip', provider is mandatory
{
  identifier_type: 'ip',
  identifier_value: '192.168.1.100',
  provider: 'Comcast' // REQUIRED - ISP provider
}
```

### File Upload Patterns

#### CRITICAL: Always Use Electron Dialog API
```typescript
// CORRECT - Electron dialog
const result = await window.electronAPI.openFileDialog({
  properties: ['openFile'],
  filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
});
const filePath = result.filePaths[0]; // Full system path

// WRONG - Browser file input (no access to file system path)
<input type="file" onChange={handleFile} /> // Don't use this
```

#### File Upload Best Practices
- **Upload buttons always available** (outside edit mode) for better UX
- Pattern: Similar to warrant uploads - immediate access, immediate save
- No need to enter edit mode to upload files
- Saves immediately to database (doesn't wait for Edit/Save)
- Examples: P2P download folder, Evidence uploads, NCMEC folders

#### Focus Restoration After File Operations
```typescript
// ALWAYS restore focus after file dialogs
const result = await window.electronAPI.openFileDialog(...);
// ... upload logic ...
await loadData();

// Restore focus to window after upload
window.focus(); // CRITICAL - prevents cursor loss

alert('Upload successful');
```

**Why This Matters:**
- Electron file dialogs steal focus from main window
- Without restoration, users must click away and back to regain cursor
- Apply to ALL file upload operations

### Identifier Input Bug Fix Pattern
```typescript
// When adding identifiers, preserve the selected type
const handleAddIdentifier = async () => {
  // ... add logic ...
  
  // Reset form - create new object to ensure React detects the change
  // IMPORTANT: Preserve the current type
  const currentType = newIdentifier.type;
  setNewIdentifier({ 
    type: currentType,  // Keep selected type
    value: '', 
    platform: '', 
    provider: '' 
  });
};
```

## Case File Organization
```
%APPDATA%\ICAC_CaseManager\cases\
└── {caseNumber}\
    ├── cybertip\
    │   ├── ncmec_report.pdf
    │   └── [NCMEC folders with metadata]
    ├── p2p_downloads\
    │   └── [downloaded evidence folders]
    ├── evidence\
    │   ├── [evidence files]
    │   └── [evidence folders]
    ├── warrants\
    │   └── {CompanyName}_{Date}_warrant.pdf
    │   └── {CompanyName}_{Date}_return\
    │       └── [return files/folders]
    ├── operations_plan\
    │   └── ops_plan.pdf
    ├── suspect\
    │   └── photo.jpg
    └── reports\
```

## Dashboard Features

### Interactive Statistics (All Clickable)

**Case Status Cards (7):**
- Overall Cases - Shows all cases
- Active Cases - Status: open
- Arrests - Status: arrest
- Closed - Status: closed_no_arrest
- Transferred - Status: referred
- Waiting on E.S.P. Warrants - Status: warrants_issued
- Ready for Residential - Status: ready_residential

**Case Type Cards (4):**
- CyberTip (🛡️)
- Peer 2 Peer (🔗)
- Chat (💬)
- Other (📋)

**Interaction Pattern:**
```typescript
// Clicking any stat shows filtered cases
const handleStatClick = (filterType, filterValue, label) => {
  // Filter cases
  // Show in expandable section
  // Display: View Case + Delete buttons
};
```

### Overdue Warrant Alerts
- **Priority Position:** Top of dashboard (before stats)
- **Visual:** Pink border, animated pulse icon
- **Clickable:** Each warrant navigates to case → warrants tab
- **Query Parameter:** `?tab=warrants` to open specific tab
- **Shows:** Company name, Case number, Due date, Days overdue

### Case Deletion
**Two-Step Confirmation:**
1. Warning dialog explaining data loss
2. Prompt requiring exact case number

**Deletes Everything:**
- Database records
- Evidence files
- Warrant files
- Suspect photos
- All related data

**Safeguards:**
- Recommends export first
- Intended for training cases only
- Must type case number to confirm

### Dashboard Report Generation

**Features:**
- "Generate Report" button (top right of dashboard)
- Date range selection modal
- Beautiful PDF with gradient styling
- Professional table layouts
- Officer name and timestamp
- Auto-opens folder after generation

**Report Contents:**
- Date range banner
- Total cases count
- Status breakdown table
- Case type distribution table
- Footer with metadata

**File Naming:** `Dashboard_Report_[YYYY-MM-DD]_to_[YYYY-MM-DD].pdf`

**PDF Generation:**
- Uses Electron's print-to-PDF functionality
- Hidden BrowserWindow renders HTML
- Inline CSS styles (works in PDF)
- Professional gradient headers
- Print-optimized margins

## Search Features

### Search Bar in Sidebar
- Simple input field
- Search icon button
- Always visible
- Navigates to Search page with query

### Search Page
**Searches Across:**
- Case numbers
- IP addresses
- Email addresses
- Usernames (with platforms)
- Suspect names
- Phone numbers
- Physical addresses

**Results Display:**
- Grouped by category (Cases, Identifiers, Suspects)
- Clickable result cards
- Shows associated case numbers
- Navigate to case on click
- URL-based: `/search?q=query`

**Backend Implementation:**
```typescript
// Uses SQL LIKE for partial matching
const query = `%${searchQuery}%`;
// Searches: cases, cybertip_identifiers, suspects tables
```

## Settings Page

### Four Main Sections

**1. Case File Storage Location**
- Displays full path to cases directory
- "Open Folder" button
- "Copy Path" button

**2. Theme Toggle**
- Dark Mode (Neon Midnight - Default)
- Light Mode (requires CSS implementation)
- Saves to localStorage
- Applies CSS class to document root

**3. License Agreement**
- Full EULA text
- Toggle show/hide
- Scrollable text area
- Security warnings included

**4. Application Info**
- App name, version, purpose
- Confirms 100% offline operation

## DA Case Export Feature

### Export Dialog (Always Shows Before Export)
**Selection Options with Checkboxes:**
- ☑️ CyberTip Files (only for CyberTip cases)
- ☑️ Search Warrants
- ☑️ Case Notes
- ☑️ Evidence Files

**Dialog Behavior:**
- At least one option must be selected
- Continue button disabled if nothing selected
- Shows descriptions for each option
- Info box explains next step

**User Flow:**
```
1. Click "Export DA Case" button
2. Dialog appears with checkboxes
3. Select desired datasets
4. Click "Continue to Export"
5. Select destination (USB/external drive)
6. Export executes (only selected items)
7. Success message + folder opens
```

### Export Folder Structure
```
Case_[CaseNumber]_DA_Export/
├── README.txt (always included)
├── 1_CyberTip_Files/ (if selected and applicable)
├── 2_Search_Warrants/ (if selected)
├── 3_Case_Notes/ (if selected)
│   └── Case_Notes.txt
└── 4_Evidence/ (if selected)
```

### Export Features
- Preserves folder structure
- Maintains timestamps
- Counts files exported
- Auto-opens folder
- Creates README with metadata
- Numbered folders for DA navigation
- Case notes as plain text file

### Backend Implementation
```typescript
// Must import getCasesPath from database.ts
import { getCasesPath } from './database';

// Respect exportOptions from dialog
if (exportOptions.cybertip && caseType === 'cybertip') {
  // Export CyberTip files
}
if (exportOptions.warrants) {
  // Export warrants
}
// etc.
```

## Critical Features

### Warrant Management (HIGH PRIORITY!)

#### Warrant Due Date Tracking
- Officers enter warrant issue date and due date (typically +30 days from service)
- Dashboard shows **overdue warrant alerts** prominently in PINK
- Color: `#FF2A6D` (accent-pink) for overdue items with animated pulse
- Must show: Company name, case number, days overdue
- Officers rely heavily on this to avoid missing deadlines
- **Clickable:** Navigates to case detail → warrants tab

#### Warrant File Organization
```typescript
// Warrant PDF naming
const fileName = `${cleanCompanyName}_${dateIssued}_warrant.pdf`;
// Example: Facebook_2024-11-25_warrant.pdf

// Warrant return folder naming
const returnFolder = `${cleanCompanyName}_${dateIssued}_return`;
// Example: Facebook_2024-11-25_return/

// Clean company names - remove invalid filesystem characters
const cleanCompanyName = companyName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
```

#### File Upload Pattern
```typescript
// Upload handler automatically detects files vs folders
const stats = fs.statSync(sourcePath);
if (stats.isDirectory()) {
  fileManager.copyFolderToCase(...); // Copies entire folder tree
} else {
  fileManager.copyFileToCase(...); // Copies single file
}
```

## IPC Communication Patterns

### Channel Naming
All IPC channels defined in `src/shared/types.ts` as constants:
```typescript
export const IPC_CHANNELS = {
  REGISTER_USER: 'register-user',
  CREATE_CASE: 'create-case',
  EXPORT_DA_CASE: 'export-da-case',
  SEARCH_CASES: 'search-cases',
  // ... etc
} as const;
```

### IPC Handler Pattern with sql.js
```typescript
// Main process (src/main/index.ts)
ipcMain.handle(IPC_CHANNELS.SOME_ACTION, async (_event, data) => {
  try {
    console.log('SOME_ACTION called with:', data); // Always log for debugging
    
    const db = getDatabase();
    const stmt = db.prepare('INSERT INTO table (col1, col2) VALUES (?, ?)');
    
    // CRITICAL: Convert undefined to null
    stmt.run(
      data.field1 || null,
      data.field2 || null
    );
    
    // saveDatabase() called automatically by wrapper
    return { success: true };
  } catch (error) {
    console.error('SOME_ACTION error:', error);
    throw error; // Let renderer handle it
  }
});
```

### Data Transform Pattern (snake_case ↔ camelCase)
```typescript
// Frontend stores in snake_case (matches database)
interface P2PData {
  download_date?: string;
  suspect_ip?: string;
}

// Transform to camelCase when sending to backend
await window.electronAPI.saveP2PData({
  caseId: parseInt(caseId),
  downloadDate: editedP2PData.download_date,  // snake → camel
  suspectIp: editedP2PData.suspect_ip,        // snake → camel
});

// Backend receives camelCase, saves as snake_case
stmt.run(
  data.caseId,
  data.downloadDate,  // camelCase from frontend
  data.suspectIp
);
```

### Preload Security
- `contextBridge.exposeInMainWorld` for secure IPC
- No direct Node.js access in renderer
- All main process functions wrapped in preload

## Component Patterns

### Edit Mode Pattern
```typescript
// Case detail pages should have view/edit modes
const [editMode, setEditMode] = useState(false);

// View mode - display data
{!editMode && <div>{data.field}</div>}

// Edit mode - input fields
{editMode && <input value={data.field} onChange={...} />}

// Toggle buttons in header
<button onClick={() => setEditMode(true)}>Edit</button>
<button onClick={handleSave}>Save</button>
<button onClick={handleCancel}>Cancel</button>
```

### Tab Pattern for Case Sections
```typescript
// Case detail has multiple sections as tabs
const tabs = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'notes', label: 'Notes', icon: '📝' },
  { id: 'evidence', label: 'Evidence', icon: '📦' },
  // ...
];

// Each tab is a separate component
{activeTab === 'warrants' && <WarrantsTab caseId={caseId} caseNumber={caseNumber} />}
{activeTab === 'evidence' && <EvidenceTab caseId={caseId} caseNumber={caseNumber} />}

// Support tab query parameter for navigation
const [searchParams] = useSearchParams();
useEffect(() => {
  const tabParam = searchParams.get('tab');
  if (tabParam) setActiveTab(tabParam);
}, [searchParams]);
```

### React State Update Patterns

**Functional setState for Async Updates:**
```typescript
// CORRECT - Avoids stale closures
setCaseData(prevData => {
  if (!prevData) return prevData;
  return { ...prevData, status: newStatus };
});

// WRONG - Can cause stale closure issues
setCaseData({ ...caseData, status: newStatus });
```

**Store Event Values Before Async:**
```typescript
// CORRECT
const handleChange = async (e) => {
  const newValue = e.target.value; // Store first
  await window.electronAPI.updateSomething(newValue);
};

// WRONG - Event object may be reused
const handleChange = async (e) => {
  await window.electronAPI.updateSomething(e.target.value);
};
```

### Modal Dialog Pattern
```typescript
// State for dialog visibility
const [showDialog, setShowDialog] = useState(false);

// Dialog component
const DialogComponent = () => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-panel border border-accent-cyan/30 rounded-lg p-6 max-w-lg w-full mx-4">
      {/* Dialog content */}
    </div>
  </div>
);

// Render conditionally
{showDialog && <DialogComponent />}
```

## Development Workflow

### Running Development Server
```powershell
npm run dev
```
- Starts Vite dev server on port 5173 (or next available)
- Launches Electron with hot reload
- Opens DevTools automatically in development

### Building Production .exe
```powershell
npm run build  # Compile TypeScript + Vite build
npm run dist   # Create Windows installer
```
Output: `dist/ICAC P.U.L.S.E. Setup.exe`

### Common Issues

#### "Hardware Mismatch" on Development
- Delete `%APPDATA%\ICAC_CaseManager\database.db`
- Restart app to re-register

#### Database Not Persisting
- Ensure `saveDatabase()` called after every write
- DBWrapper does this automatically in `run()`
- sql.js is in-memory, must explicitly save to disk

#### "tried to bind a value of an unknown type (undefined)"
- Convert all `undefined` values to `null` in IPC handlers
- Use `data.field || null` pattern

#### "table X has no column named Y"
- Add migration to `runMigrations()` in `database.ts`
- Use `ALTER TABLE ADD COLUMN` with existence check
- Don't modify CREATE TABLE statements for existing tables

#### Cursor Loss After File Upload
- Add `window.focus()` after file operations
- Pattern established for ALL file upload handlers
- Prevents need to click away/back to regain focus

#### Missing Import Errors
- Ensure all required functions imported from modules
- Example: `import { getCasesPath } from './database'`
- Check preload exposes all needed functions

#### Status Updates Not Reflecting in UI
- Use functional setState pattern
- Avoid stale closures with async operations
- Store values before async calls

#### Database Migration Failures
- Check if migration already ran
- Disable foreign keys during table recreations
- Always save database after migration
- Include error handling and logging
- Test migrations on sample data first

### Database Reset (If Needed)
**When:** Migration failures, corruption, testing fresh start

**Steps:**
1. Close application completely
2. Navigate to `%APPDATA%\ICAC_CaseManager\`
3. Delete `database.db` file
4. Restart application
5. Fresh database created with correct schema

**See:** `DATABASE_RESET_INSTRUCTIONS.md` for detailed recovery procedures

## Testing Checklist

### Before Each Major Change
- [ ] Hardware binding still works (try on fresh machine)
- [ ] Database saves correctly (restart app, data persists)
- [ ] File uploads go to correct directories
- [ ] Export maintains folder structure
- [ ] No network requests made (check dev tools Network tab)
- [ ] Focus restores correctly after file operations

### Before Production Build
- [ ] Test on clean Windows 10/11 machine
- [ ] Verify .exe is ~150-200MB
- [ ] Test export with real case data
- [ ] Verify overdue warrant alerts display prominently in pink
- [ ] Test all 6 case status workflows
- [ ] Test all 4 case type workflows
- [ ] Verify all file upload operations restore focus
- [ ] Test search across all fields
- [ ] Test Dashboard statistics and filtering
- [ ] Test DA Case Export with all options
- [ ] Test report generation with date ranges

### Feature-Specific Testing
**Dashboard:**
- [ ] All 7 status statistics clickable and accurate
- [ ] All 4 type statistics clickable and accurate
- [ ] Filtered cases display correctly
- [ ] Overdue warrants navigate to correct case/tab
- [ ] Case deletion requires case number match
- [ ] Report generation works with date ranges

**Search:**
- [ ] Finds cases by number
- [ ] Finds identifiers (IP, email, username)
- [ ] Finds suspects by name/phone/address
- [ ] Results grouped correctly
- [ ] Navigation to cases works

**Settings:**
- [ ] Cases path displays correctly
- [ ] Open folder works
- [ ] Copy path works
- [ ] Theme toggle switches (note: light mode CSS needs implementation)
- [ ] License displays

**Export:**
- [ ] Dialog shows with checkboxes
- [ ] CyberTip checkbox only for CyberTip cases
- [ ] At least one option required
- [ ] Selective export works
- [ ] Folder structure correct
- [ ] README generates
- [ ] File count accurate

## Code Organization

### File Structure
```
src/
├── main/              # Electron main process
│   ├── index.ts       # Entry point + IPC handlers
│   ├── database.ts    # SQLite with sql.js + migrations
│   ├── db-wrapper.ts  # Makes sql.js work like better-sqlite3
│   ├── hardware.ts    # Hardware binding
│   ├── fileManager.ts # File operations
│   └── pdfParser.ts   # NCMEC PDF extraction
├── preload/           # Secure IPC bridge
│   └── index.ts
├── renderer/          # React UI
│   ├── App.tsx        # Main app with routing
│   ├── components/    # Reusable components
│   │   ├── Layout.tsx # Sidebar with search bar
│   │   ├── WarrantsTab.tsx
│   │   ├── SuspectTab.tsx
│   │   ├── OpPlanTab.tsx
│   │   ├── ReportTab.tsx
│   │   ├── ProsecutionTab.tsx
│   │   └── EvidenceTab.tsx
│   ├── pages/         # Page components
│   │   ├── Dashboard.tsx # Interactive dashboard
│   │   ├── Search.tsx    # Search page
│   │   ├── Settings.tsx  # Settings page
│   │   ├── CreateCase.tsx
│   │   ├── CyberTipForm.tsx
│   │   ├── P2PForm.tsx
│   │   ├── ChatForm.tsx
│   │   ├── OtherForm.tsx
│   │   ├── CaseDetail.tsx # With export dialog
│   │   └── CasesList.tsx
│   └── styles/
└── shared/            # Shared types
    └── types.ts       # TypeScript definitions + IPC_CHANNELS
```

### Naming Conventions
- **Files:** camelCase for TypeScript (database.ts, fileManager.ts)
- **Components:** PascalCase for React (CaseForm.tsx, Dashboard.tsx, EvidenceTab.tsx)
- **Variables:** camelCase (caseNumber, hardwareId)
- **Constants:** SCREAMING_SNAKE_CASE (IPC_CHANNELS, MAX_FILE_SIZE)
- **Types/Interfaces:** PascalCase (User, Case, CyberTipData)

## Known Limitations

### sql.js Specific Issues
- `lastInsertRowid` returns 0 - must query by unique field
- Cannot handle `undefined` values - must convert to `null`
- In-memory database - must call `saveDatabase()` after writes
- Slightly slower than better-sqlite3 but works without compilation

### No Update Mechanism
- Cannot push updates once deployed
- Must get everything right before distribution
- Document all features thoroughly for users

### Light Mode
- Theme toggle exists but CSS styles not implemented
- Default dark mode (Neon Midnight) fully functional
- Light mode will require custom CSS classes

## Important Notes

- **Name:** Project is "ICAC P.U.L.S.E." (not "ICAC Case Manager")
- **Updates:** All branding must use "P.U.L.S.E." consistently
- **User Base:** Law enforcement officers, not technical users
- **Data Sensitivity:** Extremely sensitive CSAM investigation data
- **Zero Tolerance:** NO cloud features, NO data leakage
- **Prosecution Ready:** Export must be organized for DA review
- **Warrant Tracking:** Officers depend on overdue alerts - MUST be prominent and visible
- **Focus Management:** All file uploads MUST restore focus with window.focus()
- **Status Updates:** Use functional setState to avoid stale closures
- **Migrations:** Always disable foreign keys for table recreations
- **Import Management:** Ensure all dependencies properly imported (especially in main process)
- **Error Handling:** All IPC handlers should have try-catch and logging
- **User Feedback:** Always provide clear success/error messages
- **Database Backups:** Recommend users backup database.db before major updates

## Documentation Files

All documentation is located in project root:
- `project_rules` - This file (comprehensive guidelines)
- `IMPLEMENTATION_NOTES.md` - Session-by-session changes
- `STATUS_UPDATE_FIX.md` - Status update UI fix details
- `DASHBOARD_REPORT_FEATURE.md` - Report generation details
- `DA_CASE_EXPORT_FEATURE.md` - Export feature documentation
- `EXPORT_FIX_SUMMARY.md` - Export dialog and import fix
- `DATABASE_RESET_INSTRUCTIONS.md` - Recovery procedures
- `COMPLETE_FEATURES_SUMMARY.md` - All features overview