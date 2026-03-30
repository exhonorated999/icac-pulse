# Dashboard PDF Report - Page Break Fix

## Issue
In the dashboard PDF report, the "Case Status Distribution" heading appeared at the bottom of page 1, while the actual data table appeared on page 2, causing the heading to be separated from its content.

## Solution
Added a page break before the "Case Status Distribution" section to ensure the heading stays with its data on page 2.

## Changes Made

### 1. Added Page Break CSS Class
**File**: `src/main/index.ts` (Dashboard PDF export handler)

```css
.section.page-break {
  page-break-before: always;
  margin-top: 0;
  padding-top: 20px;
}
```

### 2. Applied Class to Case Status Section
Changed from:
```html
<div class="section">
  <h2>Case Status Breakdown</h2>
  ...
</div>
```

To:
```html
<div class="section page-break">
  <h2>Case Status Distribution</h2>
  ...
</div>
```

### 3. Updated Section Title
Also corrected the heading text from "Case Status Breakdown" to "Case Status Distribution" to match the dashboard display.

## PDF Structure After Fix

### Page 1
- Header with logo
- Date range
- Total Cases summary box
- Case Type Distribution (with data)

### Page 2 (New page starts here)
- **Case Status Distribution** (heading + data together)
- Public Outreach & Training (if applicable)
- Footer

## Testing

After rebuilding:
1. Go to Dashboard
2. Set a date range with some data
3. Click "Export Report"
4. Save the PDF
5. Open the PDF
6. ✅ Verify "Case Status Distribution" heading appears at the TOP of page 2
7. ✅ Verify the heading is with its data table, not separated

## Benefits
- ✅ Professional appearance
- ✅ Heading and data stay together
- ✅ Easier to read and understand
- ✅ Better page layout

## Rebuild Required

```bash
cd H:\Workspace\icac_case_manager
npm run build
npm run dev
```

## File Modified
- `src/main/index.ts` - Dashboard PDF export handler (~line 3050-3160)
