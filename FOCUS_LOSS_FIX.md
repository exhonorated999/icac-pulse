# Focus Loss Fix - February 2026

## Problem
After clicking buttons that trigger async IPC operations (Edit, Save, Delete, Export, etc.), users cannot type in text fields without clicking away from the application and back. This is caused by Electron IPC calls stealing focus from the main window.

## Root Cause
ANY async IPC operation (`window.electronAPI.*`) can cause Electron to lose focus, not just file dialog operations. This includes:
- Saving data (`saveSuspect`, `saveProsecution`, `saveReport`, etc.)
- Loading data
- Deleting records
- Export operations
- API lookups (ARIN, carrier, geocoding)
- Any database operation

## Solution Pattern
Add `window.focus()` after EVERY async operation in try/catch blocks:

```typescript
const handleSave = async () => {
  try {
    await window.electronAPI.saveSomething(data);
    await loadData(); // Reload
    
    // CRITICAL: Restore focus after all async operations
    window.focus();
    
    showToast('Saved successfully!', 'success');
  } catch (error) {
    console.error('Save failed:', error);
    window.focus(); // ALSO restore on error!
    showToast('Save failed', 'error');
  }
};
```

## Files Fixed

### Components
✅ `SuspectTab.tsx`:
  - handleSave
  - handleCarrierLookup
  - handleExportPDF
  - handleDeletePhoto
  - (handleGeocodeAddress already had it)

✅ `ProsecutionTab.tsx`:
  - handleSave

✅ `ReportTab.tsx`:
  - handleSave
  - handleExportPDF

✅ `WarrantsTab.tsx`:
  - handleSaveWarrant
  - handleMarkReceived
  - handleDeleteWarrant
  - (Upload handlers already had it)

### Pages
✅ `CaseDetail.tsx`:
  - handleSave
  - handleDeleteNote
  - (handleAddNote, handleAddIdentifier already had it)

✅ `Settings.tsx`:
  - handleSaveVeriphoneKey

### Still Need Checking
The following handlers in `CaseDetail.tsx` may need the fix (20+ handlers total):
- handleDeleteIdentifier
- handleArinLookupForIdentifier
- handleCarrierLookupForIdentifier
- handlePingIdentifierIp
- handleAddOtherIdentifier
- handleDeleteOtherIdentifier
- handleAddCyberTipFile
- handleDeleteCyberTipFile
- handleExportCase
- handleConfirmExport
- handleAddChatIdentifier
- handleDeleteChatIdentifier
- handleArinLookupForChatIdentifier
- handleCarrierLookupForChatIdentifier
- handleUploadP2PFolder
- handleArinLookup
- handlePingIp

## New Development Rule
**ALWAYS add `window.focus()` after async IPC operations:**
1. After the last `await` statement in try block
2. In the catch block before showing error messages
3. Even if using toast messages (they don't prevent focus loss)

## Testing
After applying fixes, test:
1. Click Edit button → should be able to type immediately
2. Click Save button → should be able to type immediately
3. Click any action button → cursor should work without clicking away

## Future Prevention
Add this to code review checklist:
- ✅ All async handlers have `window.focus()` in try block
- ✅ All async handlers have `window.focus()` in catch block
- ✅ window.focus() is placed AFTER all await statements

## Complete List of Fixed Files (February 24, 2026)

### Components - FIXED ✅
1. `SuspectTab.tsx` - handleSave, handleCarrierLookup, handleExportPDF, handleDeletePhoto
2. `ProsecutionTab.tsx` - handleSave
3. `ReportTab.tsx` - handleSave, handleExportPDF
4. `WarrantsTab.tsx` - handleSaveWarrant, handleMarkReceived, handleDeleteWarrant

### Pages - FIXED ✅
1. `CaseDetail.tsx` - handleSave, handleDeleteNote, handleArinLookupForIdentifier, handleCarrierLookupForIdentifier, handlePingIdentifierIp
2. `Settings.tsx` - handleSaveVeriphoneKey

### Result
The major focus loss issues after clicking Edit/Save/Delete buttons should now be resolved. Users can immediately type in text fields after these operations without needing to click away and back.

### Additional Handlers in CaseDetail.tsx (Lower Priority)
These may also benefit from the fix but are less frequently used:
- handleDeleteIdentifier (already has window.focus())
- handleAddOtherIdentifier (already has window.focus())
- handleDeleteOtherIdentifier
- handleAddCyberTipFile
- handleDeleteCyberTipFile
- handleExportCase
- handleConfirmExport
- handleAddChatIdentifier
- handleDeleteChatIdentifier
- handleArinLookupForChatIdentifier
- handleCarrierLookupForChatIdentifier
- handleUploadP2PFolder
- handleArinLookup
- handlePingIp

If focus loss persists in specific areas, check these handlers next.
