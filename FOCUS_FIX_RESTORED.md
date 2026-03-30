# Focus Fix Restored

## Issue
After today's changes, the focus issue returned where users couldn't edit fields without first clicking off the app and clicking back into it.

## Root Cause
Several dialog handlers were missing the focus restoration code that was previously added. When dialogs (file pickers, save dialogs, message boxes) close, they need to explicitly restore focus to the main window.

## Dialogs Fixed

Added focus restoration code to the following dialog handlers in `src/main/index.ts`:

### 1. Export Report PDF (Line ~2695)
```typescript
// Ask user where to save
const result = await dialog.showSaveDialog({
  title: 'Save Report as PDF',
  defaultPath: `Case_${caseInfo.case_number}_Report.pdf`,
  filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
});

// Restore focus to main window after dialog closes
if (mainWindow && !mainWindow.isDestroyed()) {
  mainWindow.focus();
}
```

### 2. Export Dashboard Report (Line ~2895)
```typescript
// Ask user where to save
const result = await dialog.showSaveDialog({
  title: 'Save Dashboard Report as PDF',
  defaultPath: `Dashboard_Report_${data.dateFrom}_to_${data.dateTo}.pdf`,
  filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
});

// Restore focus to main window after dialog closes
if (mainWindow && !mainWindow.isDestroyed()) {
  mainWindow.focus();
}
```

### 3. Export DA Case - Folder Selection (Line ~1555)
```typescript
// Ask user to select export destination
const result = await dialog.showOpenDialog({
  title: 'Select Export Destination (USB Drive, External Drive, etc.)',
  properties: ['openDirectory'],
  buttonLabel: 'Select Destination'
});

// Restore focus to main window after dialog closes
if (mainWindow && !mainWindow.isDestroyed()) {
  mainWindow.focus();
}
```

### 4. Export DA Case - Overwrite Confirmation (Line ~1575)
```typescript
const overwrite = await dialog.showMessageBox({
  type: 'warning',
  buttons: ['Cancel', 'Overwrite'],
  defaultId: 0,
  title: 'Folder Exists',
  message: `A folder named "${exportFolderName}" already exists at this location.`,
  detail: 'Do you want to overwrite it?'
});

// Restore focus to main window after dialog closes
if (mainWindow && !mainWindow.isDestroyed()) {
  mainWindow.focus();
}
```

## Already Had Focus Restoration

These dialog handlers already had the fix in place:
- ✅ `open-file-dialog` handler
- ✅ `open-folder-dialog` handler
- ✅ `save-folder-dialog` handler

## Testing

After rebuilding, test these workflows:
1. **Export Case Report to PDF**
   - Open a case → Reports tab
   - Click "Export Report as PDF"
   - Select save location
   - ✅ Verify you can immediately edit fields after dialog closes

2. **Export Dashboard Report**
   - Go to Dashboard
   - Set date range
   - Click "Export Report"
   - Select save location
   - ✅ Verify you can immediately edit fields after dialog closes

3. **Export DA Case**
   - Open a case → Case Details tab
   - Click "Export for DA"
   - Select export options
   - Choose destination folder
   - ✅ Verify you can immediately edit fields after dialog closes

4. **General Field Editing**
   - After ANY dialog interaction
   - ✅ Verify fields are immediately editable without clicking away first

## File Modified

- `src/main/index.ts` - Added focus restoration to 4 dialog handlers

## Pattern to Follow

**For ALL future dialog handlers**, always add this code immediately after the dialog closes:

```typescript
// Restore focus to main window after dialog closes
if (mainWindow && !mainWindow.isDestroyed()) {
  mainWindow.focus();
}
```

This applies to:
- `dialog.showOpenDialog()`
- `dialog.showSaveDialog()`
- `dialog.showMessageBox()`
- Any other Electron dialog

## Rebuild Required

```bash
cd H:\Workspace\icac_case_manager
npm run build
npm run dev
```

The focus issue should now be completely resolved across all dialog interactions.
