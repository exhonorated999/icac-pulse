# Active Investigations - Waiting for ESP Warrants Update

## Overview

Updated the Active Investigations section on the Dashboard to include cases with "Waiting for ESP Warrants" status and visually distinguish them from regular active cases.

## Changes Made

### File: `src/renderer/pages/Dashboard.tsx`

#### 1. Expanded Filter
**Before**: Only showed cases with `status === 'open'`
```javascript
allCases.filter(c => c.status === 'open')
```

**After**: Shows both open cases AND cases waiting for ESP warrants
```javascript
allCases.filter(c => c.status === 'open' || c.status === 'warrants_issued')
```

#### 2. Visual Distinction - Yellow Glow

Cases with "Waiting for ESP Warrants" status now have:

**A. Yellow Ring/Glow**
- Subtle yellow glow around the entire row
- CSS classes: `ring-2 ring-yellow-500/30 bg-yellow-500/5`
- Makes the row stand out while remaining professional

**B. Yellow Status Badge**
- Yellow colored badge (instead of green "Active")
- Shows "Waiting ESP" with a clock icon
- CSS: `bg-yellow-500/20 text-yellow-400`

**C. Clock Icon**
- Small clock icon next to status text
- Indicates the case is waiting/pending
- Visual reminder of the waiting state

## Visual Design

### Regular Active Case (Green)
```
┌─────────────────────────────────────────────────────┐
│ Case #    Category    Officer    [Active]    [Open] │
└─────────────────────────────────────────────────────┘
```
- No special highlight
- Green "Active" badge
- Standard row styling

### Waiting for ESP Case (Yellow Glow)
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ ← Yellow glow
┃ Case #    Category    Officer    [🕐 Waiting ESP] [Open] ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```
- Yellow glow/ring around entire row
- Yellow "Waiting ESP" badge with clock icon
- Slight yellow background tint

## Status Recognition

The update recognizes these statuses as "Active Investigations":

| Status | Display | Badge Color | Visual Effect |
|--------|---------|-------------|---------------|
| `open` | Active | Green | None (standard) |
| `warrants_issued` | Waiting ESP | Yellow | Yellow glow ring |

## User Experience

### Before
- Only "open" cases showed in Active Investigations
- Cases changed to "warrants_issued" disappeared from the list
- Users lost visibility of ongoing investigations

### After
- Both "open" and "warrants_issued" cases show
- Easy to distinguish which cases are waiting for warrants
- Maintains visibility of all active work
- Quick visual scan to see which cases need ESP responses

## CSS Classes Used

### Yellow Glow Effect
```css
ring-2 ring-yellow-500/30    /* 2px yellow ring at 30% opacity */
bg-yellow-500/5              /* Yellow background at 5% opacity */
```

### Yellow Status Badge
```css
bg-yellow-500/20             /* Yellow background at 20% opacity */
text-yellow-400              /* Bright yellow text */
rounded-full                 /* Pill-shaped badge */
```

### Icon
- SVG clock icon from Heroicons
- Filled style for better visibility
- 3x3 size (12px)

## Example Output

When viewing the Dashboard with:
- 2 open cases
- 1 case waiting for ESP warrants

**Active Investigations table shows**:
```
┌────────────────────────────────────────────────────────────┐
│ Case ID      Category    Investigator    Status      Actions│
├────────────────────────────────────────────────────────────┤
│ 2024-001     CyberTip    Officer        [Active]     [Open] │
│ 2024-002     CyberTip    Officer        [Active]     [Open] │
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 2024-003     P2P         Officer     [🕐 Waiting ESP] [Open]┃ ← Yellow glow
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
└────────────────────────────────────────────────────────────┘
```

## Benefits

### For Investigators
✅ **Visibility**: Don't lose track of cases waiting for ESP responses  
✅ **Quick Identification**: Immediately see which cases are waiting  
✅ **Workflow Management**: Better manage active vs. waiting cases  
✅ **Context Awareness**: Understand case status at a glance

### For Supervisors
✅ **Monitoring**: See all active investigations including those waiting  
✅ **Follow-up**: Easy to identify cases needing ESP follow-up  
✅ **Workload**: Better understanding of active case distribution

## Testing

After rebuilding, verify:

1. **Create test cases with different statuses**:
   ```
   Case A: status = 'open'
   Case B: status = 'warrants_issued'
   Case C: status = 'arrest'
   Case D: status = 'closed_no_arrest'
   ```

2. **Check Active Investigations section**:
   - ✅ Case A appears (open)
   - ✅ Case B appears (warrants_issued) with yellow glow
   - ❌ Case C does NOT appear (arrest - not active)
   - ❌ Case D does NOT appear (closed)

3. **Visual verification**:
   - ✅ Open cases have green "Active" badge
   - ✅ Warrants_issued cases have yellow "Waiting ESP" badge
   - ✅ Warrants_issued cases have yellow ring/glow
   - ✅ Clock icon appears next to "Waiting ESP"

4. **Functionality**:
   - ✅ "Open" button works for both types
   - ✅ Clicking case number works
   - ✅ Row hover effects work

## Related Status Values

For reference, all possible case statuses:
- `open` - Active investigation (GREEN badge)
- `warrants_issued` - Waiting for ESP warrants (YELLOW badge with glow) ← NEW
- `ready_residential` - Ready for residential warrant
- `arrest` - Arrest made
- `closed_no_arrest` - Closed without arrest
- `referred` - Transferred to another agency

Only `open` and `warrants_issued` show in Active Investigations.

## Future Enhancements

Consider adding similar visual treatments for:
- Cases nearing warrant due dates (orange glow)
- High-priority cases (red accent)
- Cases with overdue tasks (pulsing indicator)

## Rebuild Required

```bash
cd H:\Workspace\icac_case_manager
npm run build
npm run dev
```

Or for production:
```bash
npm run build
npm run dist
```

## Accessibility

The visual distinction uses:
- Color (yellow vs green)
- Icon (clock symbol)
- Text ("Waiting ESP" vs "Active")

This ensures users can identify waiting cases even if they have color blindness, as the icon and text provide additional cues beyond just color.
