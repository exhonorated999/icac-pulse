# Dashboard Layout Update

## Changes Made

### 1. KPI Ribbon (Top Metrics)
**Removed:**
- Ready for Residential

**Added:**
- Warrants Written This Month (green card with 📝 icon)
  - Shows count of warrants issued in the current month
  - Displays current month/year in subtitle
  - Green gradient styling for positive action metric

**Final KPI Order:**
1. Total Cases (cyan)
2. Waiting on E.S.P. (yellow)
3. Arrests Made (pink)
4. Warrants This Month (green)

### 2. Case Analytics Section (Left Column)
**Layout Change:**
- Split into 2-column grid
- **Left:** Case Distribution Donut Chart (unchanged)
- **Right:** Overdue Warrants moved here (previously in right sidebar)

**Overdue Warrants:**
- Displays first 4 overdue warrants with compact cards
- Each card shows: Company name, Case number, Days overdue with ⚠️ icon
- Shows "+X more overdue" if more than 4 exist
- "All Clear" message when no overdue warrants
- Max height with scroll for many warrants
- Clickable to navigate to case → warrants tab

### 3. Right Sidebar Reorganization
**New Order (Top to Bottom):**
1. **Quick Stats** (moved up from below)
   - Open Cases
   - Closed
   - Transferred
   - Clearance Rate (as divider at bottom)
   - Removed: Ready Residential

2. **Task List** (now aligned with Active Investigations)
   - Unchanged functionality
   - Better vertical alignment with left column

3. **Generate Report Button** (at bottom, unchanged)

### 4. Backend Changes
**New Database Query:**
- Added `warrantsThisMonth` query counting warrants issued in current month
- Uses SQLite `strftime('%Y-%m', date_issued)` to filter by month
- Returns integer count

**Stats Object Updates:**
- Added `warrantsThisMonth: number` field
- Included in console logging for debugging

## Benefits

1. **Better Space Utilization:** Removed empty "New Cases / Month" chart that had mock data
2. **Improved Visual Hierarchy:** Overdue warrants prominently visible in analytics section
3. **Reduced Redundancy:** Removed duplicate "Ready Residential" metric
4. **Actionable Metrics:** Warrants This Month gives officers productivity insight
5. **Better Alignment:** Quick Stats and Tasks now properly aligned with left column sections

## Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  KPI Ribbon (4 cards)                                        │
│  [Total] [Waiting ESP] [Arrests] [Warrants This Month]     │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────┬──────────────────────────┐
│  Case Analytics                  │  Quick Stats             │
│  ┌──────────┬──────────────────┐ │  - Open Cases            │
│  │  Donut   │ Overdue Warrants │ │  - Closed                │
│  │  Chart   │   [Card 1]       │ │  - Transferred           │
│  │          │   [Card 2]       │ │  - Clearance Rate        │
│  │          │   [Card 3]       │ │                          │
│  └──────────┴──────────────────┘ ├──────────────────────────┤
│                                  │  Task List               │
│  Active Investigations Table     │  - [Task 1]              │
│  [Case rows...]                  │  - [Task 2]              │
│                                  │  - [Task 3]              │
│                                  │  [+ Add Task]            │
│                                  ├──────────────────────────┤
│                                  │  [Generate Report]       │
└──────────────────────────────────┴──────────────────────────┘
```

## Testing Checklist

- [x] Backend query for warrants this month working
- [x] KPI card displays warrant count correctly
- [x] Overdue warrants moved to analytics section
- [x] Quick Stats removed Ready Residential
- [x] Quick Stats moved up in right column
- [x] Task list aligned with Active Investigations
- [x] All clickable elements still functional
- [x] Layout responsive on different screen sizes

## Files Modified

1. `src/main/index.ts`
   - Added warrantsThisMonth query
   - Added to stats object
   - Updated console logging

2. `src/renderer/pages/Dashboard.tsx`
   - Replaced "Ready Residential" KPI with "Warrants This Month"
   - Moved overdue warrants to Case Analytics section
   - Reorganized right sidebar (Quick Stats moved up)
   - Removed Ready Residential from Quick Stats
   - Added Clearance Rate to Quick Stats
