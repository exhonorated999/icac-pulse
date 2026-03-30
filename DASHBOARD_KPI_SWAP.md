# Dashboard KPI Cards Swap

## Changes Made

Updated the four main KPI cards on the dashboard to better reflect critical operational metrics.

## Card Changes

### Replaced Cards

1. **Active Cases** → **Total Cases**
   - Old: Green folder with pulse (Active/Open cases only)
   - New: Cyan stacked documents (All cases in system)
   - Rationale: Total case count is more informative for overview

2. **Clearance Rate** → **Ready for Residential**
   - Old: Cyan shield with checkmark and progress bar
   - New: Cyan house with crosshair target
   - Rationale: Ready Residential is actionable status needing attention

### Updated KPI Cards Layout

**New Four-Card Grid:**

1. ✅ **Total Cases** - Cyan (#00D4FF)
   - Icon: Stacked documents
   - Shows: Total count of all cases
   - Click: Shows all cases
   - Subtitle: Last updated time

2. ✅ **Waiting on E.S.P. Warrants** - Yellow/Orange (#FFB800)
   - Icon: Document with clock
   - Shows: Cases waiting on warrant returns
   - Click: Shows warrants_issued cases
   - Subtitle: Average wait time

3. ✅ **Arrests Made** - Pink (#FF2A6D)
   - Icon: Handcuffs
   - Shows: Cases with arrests
   - Click: Shows arrest cases
   - Subtitle: "Critical milestone"

4. ✅ **Ready for Residential** - Cyan (#00D4FF)
   - Icon: House with crosshair
   - Shows: Cases ready for residential search warrants
   - Click: Shows ready_residential cases
   - Subtitle: "Ready for action"

## Visual Changes

### Total Cases Card
- **Color:** Cyan gradient background
- **Icon:** AllCasesIcon (stacked documents)
- **Stat:** `stats.total` (all cases)
- **Interactive:** Clickable, shows filtered list
- **Hover:** Scale effect

### Ready Residential Card
- **Color:** Cyan gradient background
- **Icon:** ReadyResidentialIcon (house with target)
- **Stat:** `stats.readyResidential` (ready_residential status)
- **Interactive:** Clickable, shows filtered list
- **Hover:** Scale effect
- **Action indicator:** Arrow (→) instead of progress bar

## Removed Elements

### Clearance Rate Card Components:
- Progress bar (percentage visual)
- `clearanceRate` calculation
- Shield with checkmark icon

### Active Cases Card Components:
- Green color scheme (now cyan)
- Folder with pulse icon
- Filter for 'open' status only

## Benefits

1. **Total Cases** provides better overview than just active cases
2. **Ready Residential** is actionable status requiring officer attention
3. More consistent color scheme (two cyan, one yellow, one pink)
4. Both new cards are clickable/filterable like others
5. Ready Residential gets visibility it deserves as critical workflow stage

## Technical Implementation

### Import Changes
```tsx
// Removed:
// - ActiveCasesIcon
// - ClearanceRateIcon

// Using:
// - AllCasesIcon (for Total Cases)
// - ReadyResidentialIcon (for Ready Residential)
```

### Card Structure
Both new cards follow the standard interactive pattern:
```tsx
<button onClick={() => handleStatClick(...)}>
  <div className="flex justify-between items-start mb-4">
    <div>
      <p className="text-text-muted text-sm mb-1">Title</p>
      <p className="text-4xl font-bold text-color">{stat}</p>
    </div>
    <div className="w-12 h-12">
      <Icon className="w-full h-full" />
    </div>
  </div>
  <p className="text-text-muted text-xs">Subtitle</p>
</button>
```

## Dashboard Stats Object

The dashboard relies on these stats:
```typescript
{
  total: number,           // Used by Total Cases ✓
  active: number,          // No longer displayed
  warrantsIssued: number,  // Used by Waiting on E.S.P. ✓
  arrests: number,         // Used by Arrests Made ✓
  readyResidential: number // Used by Ready Residential ✓
  // ... other stats for sidebar
}
```

## User Experience

Users now see at a glance:
1. **How many total cases** in the system
2. **How many warrants** are pending (with wait time)
3. **How many arrests** have been made (success metric)
4. **How many cases** are ready for residential action (actionable)

This provides a better balance of:
- Overview metrics (Total Cases)
- Waiting metrics (E.S.P. Warrants)
- Success metrics (Arrests)
- Action metrics (Ready Residential)

## Color Distribution

- **Cyan:** 2 cards (Total Cases, Ready Residential)
- **Yellow/Orange:** 1 card (Waiting on E.S.P.)
- **Pink:** 1 card (Arrests Made)

Balanced color scheme with emphasis on cyan (primary theme color).
