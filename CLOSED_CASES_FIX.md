# Closed Cases Stat Fix - February 24, 2026

## Issue
Cases marked as "Arrested" or "Transferred" were showing in their respective stats but NOT in the "Closed Cases" stat on the dashboard.

## Business Logic
From a law enforcement perspective, both arrested and transferred cases are effectively closed cases. The case may continue through the prosecution system or with another agency, but the investigation phase is complete for this agency.

Therefore, "Closed Cases" should include:
- Cases with status `closed_no_arrest` (closed without arrest)
- Cases with status `arrest` (arrested - investigation complete)
- Cases with status `referred` (transferred to another agency)

## Changes Made

### 1. Backend - Dashboard Stats Calculation
**File:** `src/main/index.ts`

**Change:** Updated the `closed` stat calculation to include all three statuses:
```typescript
closed: statusStats.closed_no_arrest + statusStats.arrest + statusStats.referred, // Include arrested and transferred cases in closed count
```

### 2. Frontend - Dashboard Click Filter
**File:** `src/renderer/pages/Dashboard.tsx`

**Change:** Updated `handleStatClick` to filter for all three statuses when "Closed Cases" is clicked:
```typescript
// Special case: "Closed Cases" includes closed_no_arrest, arrest, and referred (transferred)
if (filterValue === 'closed_no_arrest') {
  filtered = allCases.filter(c => c.status === 'closed_no_arrest' || c.status === 'arrest' || c.status === 'referred');
} else {
  filtered = allCases.filter(c => c.status === filterValue);
}
```

## Result
- Dashboard "Closed Cases" stat now correctly shows: arrested cases + closed_no_arrest cases + transferred cases
- Clicking "Closed Cases" shows all cases with any of these three statuses
- "Arrests Made" and "Transferred Cases" stats remain separate and still clickable for filtering specific statuses
- All stats work independently but arrested and transferred cases count toward closed total

## Example
If you have:
- 2 cases with status `arrest`
- 1 case with status `closed_no_arrest`
- 1 case with status `referred` (transferred)

Dashboard will show:
- Arrests Made: **2**
- Transferred Cases: **1**
- Closed Cases: **4** (2 arrested + 1 closed without arrest + 1 transferred)

## Testing
1. Mark a case as "Arrested" or "Transferred"
2. Check Dashboard - "Closed Cases" count should increase
3. Click "Closed Cases" - should see arrested, closed_no_arrest, and transferred cases
4. Click "Arrests Made" - should see only arrested cases
5. Click "Transferred Cases" - should see only transferred cases
