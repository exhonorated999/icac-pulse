# ICAC P.U.L.S.E. - Testing Guide

## What's Been Fixed

### 1. Create Case Button - FIXED ✅
**Problems:**
- sql.js was receiving `undefined` values which it can't handle
- No proper error messages shown to user
- File upload using browser API instead of Electron dialog

**Fixes:**
- Convert all `undefined` values to `null` in SAVE_CYBERTIP_DATA handler
- Added detailed console logging to track the flow
- Better error messages (shows "Case number already exists" for UNIQUE constraint)
- Changed PDF upload to use Electron's file dialog API

### 2. CyberTip Case Detail Page - CREATED ✅
**Features:**
- Full case overview with all CyberTip data
- Status display with color coding
- Priority level display
- Tabbed interface (Overview, Warrants, Suspect, Operations, Report, Prosecution)
- Quick action buttons
- Link to open NCMEC folder location
- Export case button (placeholder)

## How to Test CyberTip Case Creation

### Step 1: Start the App
The app should already be running. If not:
```powershell
npm run dev
```

### Step 2: Create a CyberTip Case
1. Click "Create Case" from the sidebar or dashboard
2. Select the "CyberTip" card
3. Fill in the required fields:
   - **Case Number**: Use a UNIQUE number (e.g., `2024-TEST-001`)
   - **CyberTipline Report Number**: Any number (e.g., `123456789`)
4. Optionally fill in other fields:
   - Report Date
   - Occurrence Date
   - Reporting Company (e.g., "Facebook")
   - Priority Level (dropdown)
   - Date Received UTC
5. Optional: Upload a NCMEC PDF
   - Click the upload area
   - Select a PDF file (any PDF for testing)
   - Note: Auto-parsing may not work without a real NCMEC PDF
6. Click "Create Case" button

### Step 3: Expected Results
✅ Console should show:
```
Creating case with data: {...}
Case created: {id: X, ...}
Saving CyberTip data: {...}
CyberTip data saved
```

✅ Success alert: "CyberTip case created successfully!"

✅ Automatically navigates to case detail page showing:
- Case number
- Case type (CyberTip)
- Status (Open)
- All the information you entered
- Tabbed interface

### Known Issues & Workarounds

#### Issue 1: "Case number already exists"
**Cause:** You're trying to use a case number that's already in the database.
**Fix:** Use a different, unique case number.

#### Issue 2: PDF parsing fails
**Cause:** The PDF parser expects specific NCMEC PDF format.
**Workaround:** Skip the PDF upload and manually enter data. The form works fine without a PDF.

## Database Location
Cases are stored in:
```
C:\Users\[Username]\AppData\Roaming\ICAC_CaseManager\database.db
```

To reset the database (for testing):
1. Close the Electron app
2. Delete the `database.db` file
3. Restart the app
4. Re-register your username

## Console Errors to Ignore
These are harmless:
- `ERROR:cache_util_win.cc` - GPU cache errors (cosmetic)
- `ERROR:disk_cache.cc` - Disk cache errors (cosmetic)

## Errors to Watch For
❌ "tried to bind a value of an unknown type (undefined)"
   - This should be FIXED now. If you see it, let me know.

❌ "UNIQUE constraint failed"
   - Normal error if you reuse a case number
   - Try a different case number

## Next: P2P Case Form
Once CyberTip is working, we'll create the P2P (Peer-to-Peer) case form with fields for:
- Download date
- Platform (Shareazza, BitTorrent, Freenet, Other)
- Suspect IP address
- IP provider
- Download folder path

Then Chat and Other case types.
