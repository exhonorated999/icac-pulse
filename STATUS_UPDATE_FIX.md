# Status Update UI Refresh Fix

## Issue
When changing case status via the dropdown, the backend updated correctly but the UI still showed the old status until page refresh.

## Root Cause
The `setCaseData` call was using a closure over the old `caseData` object, which could cause React to not detect the state change properly due to timing issues with the async IPC call.

## Solution

Updated the status change handler to use React's functional setState pattern:

### Before:
```typescript
onChange={async (e) => {
  try {
    await window.electronAPI.updateCase(caseData.id, {
      status: e.target.value
    });
    setCaseData({ ...caseData, status: e.target.value });
  } catch (error) {
    console.error('Failed to update status:', error);
    alert('Failed to update status');
  }
}}
```

### After:
```typescript
onChange={async (e) => {
  const newStatus = e.target.value;
  try {
    // Update backend first
    await window.electronAPI.updateCase(caseData.id, {
      status: newStatus
    });
    
    // Update local state after successful backend update
    setCaseData(prevData => {
      if (!prevData) return prevData;
      return { ...prevData, status: newStatus };
    });
    
    console.log('Status updated successfully to:', newStatus);
  } catch (error) {
    console.error('Failed to update status:', error);
    alert('Failed to update status');
    
    // Reload case data to revert UI to actual DB value
    await loadCaseData();
  }
}}
```

## Key Improvements

1. **Functional setState Pattern:**
   - Uses `setCaseData(prevData => ...)` instead of `setCaseData({ ...caseData, ... })`
   - Ensures React always uses the latest state
   - Prevents stale closure issues

2. **Better Variable Management:**
   - Stores `e.target.value` in `newStatus` variable
   - Prevents issues with event object being reused

3. **Error Recovery:**
   - If status update fails, reloads case data
   - Ensures UI always matches database state

4. **Debug Logging:**
   - Logs successful updates for troubleshooting
   - Helps verify the update path is working

## Testing

### Test Case 1: Normal Status Change
1. Open a case
2. Change status from "Open" to "Warrants Issued"
3. **Expected:** Dropdown immediately shows "🟡 Warrants Issued"
4. **Expected:** Status badge updates with yellow color
5. **Expected:** No page refresh needed

### Test Case 2: Rapid Status Changes
1. Open a case
2. Quickly change status multiple times
3. **Expected:** Each change reflects immediately
4. **Expected:** Final status matches last selection

### Test Case 3: Error Handling
1. Open a case
2. Change to invalid status (shouldn't be possible with dropdown)
3. **Expected:** Error alert shows
4. **Expected:** UI reverts to actual database status

### Test Case 4: Color Updates
1. Open a case
2. Change through different statuses:
   - Open (green)
   - Warrants Issued (yellow)
   - Ready for Residential (cyan)
   - Arrested (pink)
3. **Expected:** Colors update immediately with each change

## Files Modified
- `src/renderer/pages/CaseDetail.tsx` - Updated status change handler

## Browser Console Verification

After changing status, you should see:
```
Status updated successfully to: warrants_issued
```

If you see errors, check:
1. Database migration ran successfully
2. CHECK constraint was updated
3. No other JavaScript errors in console
