# Dashboard Report Date Filter - Debugging

## Issue Identified

The dashboard shows "New Cases This Month: 1" but when generating a report for September 30 - December 19, 2025, it shows "NEW CASES: 0".

## Problem

The date range filtering in the dashboard report generation is not correctly matching cases within the specified date range.

## Debugging Added

### File: `src/main/index.ts`

Added comprehensive console logging to the `GENERATE_DASHBOARD_REPORT` handler to debug the date filtering logic.

### New Logging Output

The code now logs:
1. **Date range being used**:
   - Input date strings
   - Parsed Date objects
   - ISO string representations

2. **For each case**:
   - Case number
   - Date field value
   - Parsed case date
   - Whether it's in range (true/false)
   - Individual comparisons (afterFrom, beforeTo)

## How to Debug

### 1. Rebuild and Run
```bash
npm run build
npm run dev
```

### 2. Generate a Report
1. Open Dashboard
2. Click "Generate Report"
3. Select date range: September 30, 2025 - December 19, 2025
4. Click "Generate"

### 3. Check Console Output
Press F12 to open Developer Tools → Console tab

Look for output like:
```javascript
Date filtering: {
  fromDate: "2025-09-30T00:00:00.000Z",
  toDate: "2025-12-19T23:59:59.999Z",
  fromDateInput: "2025-09-30",
  toDateInput: "2025-12-19"
}

Checking case: {
  caseNumber: "23-123456",
  dateField: "2025-12-20 10:30:45",
  caseDate: "2025-12-20T10:30:45.000Z",
  isInRange: false,
  comparison: {
    afterFrom: true,
    beforeTo: false  // ← This shows why it's excluded
  }
}
```

## Potential Issues to Look For

### Issue 1: Date Format Mismatch
**Symptom**: Dates not parsing correctly  
**Check**: Look at the `dateField` value in console  
**Possible formats**:
- SQLite: `2025-12-20 10:30:45`
- ISO: `2025-12-20T10:30:45.000Z`
- Unix timestamp: `1734692445000`

### Issue 2: Timezone Problems
**Symptom**: Dates off by hours  
**Check**: Compare `caseDate` ISO string to expected date  
**Solution**: May need to use UTC date methods

### Issue 3: Date Range Boundaries
**Symptom**: Cases on boundary dates excluded  
**Check**: Look at `comparison.afterFrom` and `comparison.beforeTo`  
**Current logic**: Includes end date through 23:59:59.999

### Issue 4: Database Date Column Name
**Symptom**: `No date field found in case` warnings  
**Check**: Console shows which field name is found  
**Current checks**: `created_at`, `createdAt`, `created`, `date_created`

## Expected Behavior

If case was created on December 20, 2025:
- Date range Sep 30 - Dec 19: **Should NOT include** ❌
- Date range Sep 30 - Dec 20: **Should include** ✅
- Date range Sep 30 - Dec 21: **Should include** ✅

If case was created on December 19, 2025:
- Date range Sep 30 - Dec 19: **Should include** ✅ (through 23:59:59)

## Common Fixes

### Fix 1: Wrong Date Field
If console shows `No date field found in case`:
```javascript
// Add the correct field name to the check
const dateField = c.created_at || c.createdAt || c.created || c.date_created || c.YOUR_FIELD_NAME;
```

### Fix 2: Date Parsing Issues
If dates not parsing correctly:
```javascript
// Try explicit parsing
const caseDate = new Date(dateField.replace(' ', 'T') + 'Z'); // Convert SQLite to ISO
```

### Fix 3: Timezone Offset
If dates off by timezone hours:
```javascript
// Use UTC methods
const fromDate = new Date(Date.UTC(year, month, day, 0, 0, 0));
```

## Testing Steps

1. **Create a test case**:
   - Note the exact date/time it's created
   - Check database: `SELECT case_number, created_at FROM cases;`

2. **Generate report with different ranges**:
   - Range that should exclude the case
   - Range that should include the case
   - Boundary date ranges

3. **Check console logs**:
   - Verify date parsing is correct
   - Check `isInRange` matches expectations
   - Look for any errors or warnings

## Next Steps Based on Console Output

### If dates are parsing correctly but still not matching:
- Check the comparison logic (>=, <=)
- Verify timezone handling
- Check if date range inputs are swapped

### If dates are NOT parsing correctly:
- Check the actual format in the database
- Update parsing logic to handle that format
- Consider standardizing date storage format

### If no date field found:
- Check the database schema
- Update the field name checking logic
- Add console.log to see all available fields

## Remove Debugging Later

Once the issue is identified and fixed, remove the detailed console logging for production:

```javascript
// Keep minimal logging
console.log('Cases in range:', casesInRange.length);

// Remove detailed per-case logging
```

## File Modified

- `src/main/index.ts` - Added debug logging to GENERATE_DASHBOARD_REPORT handler

## Rebuild Required

```bash
npm run build
npm run dev
```

Then test report generation and check console output.
