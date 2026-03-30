# Offense Reference Enhancements - Implementation Status

## ✅ COMPLETED - Backend Infrastructure

### 1. Database Migration
- Added `category` column to `offense_reference` table
- Column type: `TEXT DEFAULT 'state' CHECK(category IN ('state', 'federal'))`
- All existing records defaulted to 'state'
- Migration runs automatically on app start

### 2. IPC Handlers Updated
**ADD_OFFENSE:**
- Now includes `category` field (defaults to 'state')
- Updated SQL: `INSERT ... (... category, ...)  VALUES (?, ?, ?, ?, ?, ?, ?)`

**UPDATE_OFFENSE:**
- Now includes `category` field in updates
- Updated SQL: `UPDATE ... SET ... category = ? ...`

**New: EXPORT_OFFENSES:**
- Opens save dialog
- Exports all offenses to JSON file
- Includes metadata (export date, version, app name, count)
- Filename: `Offense_References_YYYY-MM-DD.json`

**New: IMPORT_OFFENSES:**
- Opens open dialog
- Reads JSON file
- Validates format
- Options:
  - `overwriteDuplicates: boolean`
- Detects duplicates by: `charge_code` + `category`
- Returns: `{ imported, skipped, updated }`

### 3. IPC Channels Added
- `EXPORT_OFFENSES: 'export-offenses'`
- `IMPORT_OFFENSES: 'import-offenses'`

### 4. Preload Functions Exposed
- `exportOffenses: () => Promise<any>`
- `importOffenses: (options: { overwriteDuplicates: boolean }) => Promise<any>`

### 5. TypeScript Declarations (App.tsx)
- Both new functions added to `window.electronAPI` interface

### 6. Handler Functions (OffenseReference.tsx)
**handleExport():**
- Calls `window.electronAPI.exportOffenses()`
- Shows success alert with file path and count

**handleImport(overwriteDuplicates):**
- Calls `window.electronAPI.importOffenses({ overwriteDuplicates })`
- Reloads offenses after import
- Shows detailed summary: imported, updated, skipped

### 7. State Management (OffenseReference.tsx)
- Added `activeTab: 'state' | 'federal'` state
- Added `category: 'state' | 'federal'` to formData
- Added `showImportDialog` state
- Added category to Offense interface

### 8. Filtering Logic
- Filter by `activeTab` (state/federal)
- Then filter by search query

---

## ⏳ TODO - Frontend UI Components

### 1. Add Category Dropdown to Add/Edit Dialog

**In the Add Offense Dialog** (around line 450):

Add after the "Charge Code" field:
```tsx
<div>
  <label className="block text-sm font-medium text-accent-cyan mb-2">
    Category <span className="text-accent-pink">*</span>
  </label>
  <select
    value={formData.category}
    onChange={(e) => setFormData({ ...formData, category: e.target.value as 'state' | 'federal' })}
    className="w-full px-4 py-3 bg-background border border-accent-cyan/30 rounded-lg
             text-text-primary focus:outline-none focus:border-accent-cyan"
  >
    <option value="state">State</option>
    <option value="federal">Federal</option>
  </select>
</div>
```

**In the Edit Dialog:** Same dropdown (around line 650)

---

### 2. Add State/Federal Tabs

**After the search bar** (around line 370), add:
```tsx
{/* Category Tabs */}
<div className="mb-6 flex items-center gap-4">
  <button
    onClick={() => setActiveTab('state')}
    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
      activeTab === 'state'
        ? 'bg-accent-cyan text-background'
        : 'bg-panel text-text-muted hover:text-text-primary border border-accent-cyan/20'
    }`}
  >
    State Offenses ({offenses.filter(o => o.category === 'state').length})
  </button>
  <button
    onClick={() => setActiveTab('federal')}
    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
      activeTab === 'federal'
        ? 'bg-accent-cyan text-background'
        : 'bg-panel text-text-muted hover:text-text-primary border border-accent-cyan/20'
    }`}
  >
    Federal Offenses ({offenses.filter(o => o.category === 'federal').length})
  </button>
</div>
```

---

### 3. Add Export/Import Buttons

**In the header section** (around line 303), update the button container:
```tsx
<div className="flex gap-3">
  {/* Export Button */}
  <button
    onClick={handleExport}
    className="px-4 py-3 bg-panel border border-accent-cyan/30 text-accent-cyan rounded-lg font-medium
             hover:bg-accent-cyan/10 transition-colors flex items-center gap-2"
    title="Export all offenses to share with other users"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
    </svg>
    Export
  </button>

  {/* Import Button */}
  <button
    onClick={() => setShowImportDialog(true)}
    className="px-4 py-3 bg-panel border border-accent-cyan/30 text-accent-cyan rounded-lg font-medium
             hover:bg-accent-cyan/10 transition-colors flex items-center gap-2"
    title="Import offenses from another user"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
    </svg>
    Import
  </button>

  {/* Add Offense Button */}
  <button
    onClick={() => setShowAddDialog(true)}
    className="px-6 py-3 bg-accent-cyan text-background rounded-lg font-medium
             hover:bg-accent-cyan/90 transition-colors flex items-center gap-2 shadow-lg"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
    </svg>
    Add Offense
  </button>
</div>
```

---

### 4. Add Import Options Dialog

**Add before the closing `</div>` of the main container** (around line 850):
```tsx
{/* Import Dialog */}
{showImportDialog && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
    <div className="bg-panel border border-accent-cyan/30 rounded-xl p-8 max-w-md w-full">
      <h3 className="text-2xl font-bold text-text-primary mb-4">Import Offense References</h3>
      
      <p className="text-text-muted mb-6">
        Choose how to handle duplicate offenses (same charge code + category):
      </p>
      
      <div className="space-y-3 mb-8">
        <button
          onClick={() => handleImport(false)}
          className="w-full p-4 bg-background border border-accent-cyan/30 rounded-lg text-left
                   hover:border-accent-cyan hover:bg-accent-cyan/5 transition-colors group"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-cyan/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent-cyan/20 transition-colors">
              <span className="text-xl">⏭️</span>
            </div>
            <div>
              <p className="text-text-primary font-semibold mb-1">Skip Duplicates</p>
              <p className="text-text-muted text-sm">
                Keep your existing offenses. Only add new ones.
              </p>
            </div>
          </div>
        </button>
        
        <button
          onClick={() => handleImport(true)}
          className="w-full p-4 bg-background border border-accent-cyan/30 rounded-lg text-left
                   hover:border-accent-cyan hover:bg-accent-cyan/5 transition-colors group"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-cyan/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent-cyan/20 transition-colors">
              <span className="text-xl">🔄</span>
            </div>
            <div>
              <p className="text-text-primary font-semibold mb-1">Overwrite Duplicates</p>
              <p className="text-text-muted text-sm">
                Replace existing offenses with imported versions.
              </p>
            </div>
          </div>
        </button>
      </div>
      
      <div className="bg-accent-cyan/5 border border-accent-cyan/20 rounded-lg p-4 text-sm text-text-muted mb-6">
        <p className="mb-2"><strong className="text-text-primary">💡 Tip:</strong></p>
        <p>Duplicates are detected by matching both charge code AND category (state/federal).</p>
      </div>
      
      <button
        onClick={() => setShowImportDialog(false)}
        className="w-full px-4 py-3 bg-background border border-accent-cyan/30 text-text-primary rounded-lg
                 hover:bg-panel transition-colors"
      >
        Cancel
      </button>
    </div>
  </div>
)}
```

---

## Export File Format

```json
{
  "exportDate": "2026-02-22T20:30:00.000Z",
  "version": "1.0",
  "appName": "ICAC P.U.L.S.E.",
  "count": 25,
  "offenses": [
    {
      "id": 1,
      "charge_code": "PC 311.11(a)",
      "charge_description": "Possession of child pornography",
      "seriousness": "felony",
      "sentencing_range": "16 months, 2 years, or 3 years",
      "notes": "CALCRIM 1140",
      "category": "state",
      "display_order": 1
    },
    {
      "id": 2,
      "charge_code": "18 USC 2252A(a)(2)",
      "charge_description": "Receipt of child pornography",
      "seriousness": "felony",
      "sentencing_range": "5 to 20 years federal",
      "notes": "Federal mandatory minimum",
      "category": "federal",
      "display_order": 2
    }
  ]
}
```

---

## User Workflow

### Sharing Offenses (Officer A)
1. Opens Offense Reference page
2. Clicks "Export" button
3. Selects save location
4. File created: `Offense_References_2026-02-22.json`
5. Shares file via email/USB/network drive

### Importing Offenses (Officer B)
1. Opens Offense Reference page
2. Clicks "Import" button
3. Dialog appears with two options:
   - "Skip Duplicates" - Keep existing
   - "Overwrite Duplicates" - Replace with imported
4. Selects preferred option
5. File picker opens
6. Selects shared JSON file
7. Import processes
8. Summary alert shows:
   - ✅ Imported: X new offenses
   - 🔄 Updated: Y existing offenses
   - ⏭️ Skipped: Z duplicates
9. Page refreshes with new offenses

---

## Benefits

### For Officers
- ✅ Share expertise with new detectives
- ✅ Agency-wide standardization
- ✅ Save time on setup
- ✅ Keep local customizations

### For Agencies
- ✅ Training tool for new hires
- ✅ Consistent charge documentation
- ✅ Knowledge preservation
- ✅ Inter-agency collaboration

### Technical
- ✅ Simple JSON format (human-readable)
- ✅ Version tracking
- ✅ Metadata included
- ✅ Duplicate detection
- ✅ User control (skip vs overwrite)

---

## Testing Checklist

### Backend (Complete ✅)
- [x] Database migration adds category column
- [x] Default category is 'state'
- [x] ADD_OFFENSE includes category
- [x] UPDATE_OFFENSE includes category
- [x] Export creates JSON file
- [x] Import reads JSON file
- [x] Duplicate detection works
- [x] Skip duplicates works
- [x] Overwrite duplicates works

### Frontend (Needs UI)
- [ ] Category dropdown in Add dialog
- [ ] Category dropdown in Edit dialog
- [ ] State/Federal tabs display
- [ ] Tab filtering works
- [ ] Tab counts accurate
- [ ] Export button appears
- [ ] Import button appears
- [ ] Import options dialog works
- [ ] Import summary displays

---

## Files Modified

### Backend (Complete)
1. `src/main/database.ts` - Migration for category column
2. `src/main/index.ts` - Updated ADD/UPDATE, added EXPORT/IMPORT handlers
3. `src/shared/types.ts` - Added IPC channel names
4. `src/preload/index.ts` - Exposed export/import functions
5. `src/renderer/App.tsx` - TypeScript declarations

### Frontend (Needs UI Updates)
6. `src/renderer/pages/OffenseReference.tsx` - Add category dropdown, tabs, export/import buttons, import dialog

---

## Quick Implementation Steps

1. **Add Category Dropdown** - Copy code from section 1
2. **Add Tabs** - Copy code from section 2
3. **Update Header Buttons** - Copy code from section 3
4. **Add Import Dialog** - Copy code from section 4
5. **Test Export** - Should work immediately
6. **Test Import** - Should work with both options

All backend logic is complete and tested. Just need to add the UI components!
