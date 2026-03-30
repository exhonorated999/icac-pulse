# Dashboard Statistics Correction

## Changes Made

### KPI Ribbon (Top 4 Metrics) - CORRECTED

**Previous (Incorrect):**
1. Total Cases
2. Waiting on E.S.P.
3. Arrests Made
4. Warrants This Month

**Current (Correct):**
1. **New Cases This Month** (Cyan) - Shows cases created in current calendar month (e.g., December 2024)
2. **Waiting on E.S.P.** (Yellow) - Cases with warrants issued status
3. **Arrests Made** (Pink) - Cases with arrest status
4. **Ready for Residential** (Green) - Cases ready for residential search warrant execution

### Quick Stats Sidebar - CORRECTED

**Previous (Incorrect):**
- Open Cases
- Closed
- Transferred
- Clearance Rate

**Current (Correct):**
1. **Open Cases** - Cases with open status
2. **Closed Cases** - Cases with closed_no_arrest status
3. **Transferred Cases** - Cases with referred status
4. **Warrants This Month** - Warrants written in current calendar month (e.g., December 2024)

## Backend Changes

### New Database Queries

1. **New Cases This Month:**
```sql
SELECT COUNT(*) as count 
FROM cases 
WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
```
- Uses SQLite's `strftime` to match year-month of case creation
- Calendar month basis (not 30-day rolling period)
- Example: In December 2024, shows all cases created between Dec 1-31, 2024

2. **Warrants This Month:**
```sql
SELECT COUNT(*) as count 
FROM warrants 
WHERE strftime('%Y-%m', date_issued) = strftime('%Y-%m', 'now')
```
- Uses SQLite's `strftime` to match year-month of warrant issuance
- Calendar month basis (not 30-day rolling period)
- Example: In December 2024, shows all warrants issued between Dec 1-31, 2024

### Stats Object Updates

Added fields:
- `newCasesThisMonth: number` - Count of cases created this month
- `warrantsThisMonth: number` - Count of warrants issued this month

## Display Formatting

### KPI Cards - Month Display
Both "New Cases This Month" and Quick Stats "Warrants This Month" display the current month/year:
```javascript
new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
// Output: "December 2024"
```

### Clickable Functionality

**New Cases This Month (KPI):**
- Filters cases client-side by creation date
- Shows filtered list when clicked
- Compares month and year of case creation with current date

**Warrants This Month (Quick Stats):**
- Shows alert with count and month when clicked
- Could be enhanced to show filtered warrant list

## Layout Summary

```
┌─────────────────────────────────────────────────────────────┐
│  KPI Ribbon                                                  │
│  [New Cases This Month] [Waiting ESP] [Arrests] [Ready Res] │
│     Cyan - December        Yellow      Pink       Green      │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────┬──────────────────────────┐
│  Case Analytics                  │  Quick Stats             │
│  ┌──────────┬──────────────────┐ │  • Open Cases            │
│  │  Donut   │ Overdue Warrants │ │  • Closed Cases          │
│  │  Chart   │                  │ │  • Transferred Cases     │
│  │          │                  │ │  • Warrants This Month   │
│  └──────────┴──────────────────┘ │    (December 2024)       │
│                                  ├──────────────────────────┤
│  Active Investigations Table     │  Task List               │
│                                  │  ...                     │
└──────────────────────────────────┴──────────────────────────┘
```

## Key Differences: Calendar Month vs 30-Day Period

✅ **Calendar Month (Implemented):**
- December 1-31, 2024
- Resets at beginning of each month
- Easier to understand and report on
- Matches standard business reporting

❌ **30-Day Rolling Period (NOT Implemented):**
- Last 30 days from current date
- Changes daily
- More complex to understand

## Testing Notes

Current test data shows:
- `newCasesThisMonth: 0` (no cases created in December 2024)
- `warrantsThisMonth: 0` (no warrants issued in December 2024)
- All 10 test cases appear to be from previous months

To test:
1. Create a new case → should increment "New Cases This Month"
2. Add a warrant to any case → should increment "Warrants This Month"
3. Check at month rollover (January 1) → both should reset to 0

## Files Modified

1. `src/main/index.ts`
   - Added `newCasesThisMonth` query
   - Updated stats object
   - Updated console logging

2. `src/renderer/pages/Dashboard.tsx`
   - Changed first KPI from "Total Cases" to "New Cases This Month"
   - Changed fourth KPI from "Warrants This Month" back to "Ready for Residential"
   - Updated Quick Stats to show all 4 required items
   - Added month/year display formatting
   - Added client-side filtering for new cases
