# Public Outreach Feature

## Overview
Track public outreach events and law enforcement training sessions to document ICAC personnel's community engagement efforts.

## Database Schema

### `public_outreach` Table
```sql
CREATE TABLE public_outreach (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  location TEXT NOT NULL,
  num_attendees INTEGER NOT NULL,
  is_law_enforcement INTEGER DEFAULT 0,  -- 0 = public outreach, 1 = LE training
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_public_outreach_date ON public_outreach(date);
```

## Features

### 1. Navigation
- **Sidebar Button:** "Public Outreach" with green neon icon
- Located between "Create Case" and "All Cases"
- Routes:
  - `/outreach` - List view
  - `/outreach/new` - Add new event
  - `/outreach/edit/:id` - Edit existing event

### 2. Outreach List Page

**Statistics Cards:**
- Total Events
- Public Outreach (count)
- LE Training (count)  
- Total Attendees (sum across all events)

**Filter Buttons:**
- All Events
- Public Outreach only
- Law Enforcement Training only

**Table Columns:**
- Date
- Location
- Type (badge: "Public Outreach" green / "Law Enforcement" cyan)
- Attendees (number)
- Notes (truncated)
- Actions (Edit / Delete buttons)

### 3. Add/Edit Event Form

**Fields:**
- **Date** * (date picker, defaults to today)
- **Location** * (text input)
  - Example: "Jefferson High School, Main Auditorium"
- **Number of Attendees** * (number input, min: 1)
- **Law Enforcement Training** (checkbox)
  - Unchecked = Public Outreach
  - Checked = Law Enforcement Training
- **Notes** (optional textarea)

**Event Type Display:**
- Dynamic badge showing current selection
- 🎓 Law Enforcement Training (cyan)
- 👥 Public Outreach (green)

### 4. Dashboard Report Integration

**New Section in PDF Report:**
```
Public Outreach & Training
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Total Events │ Public       │ LE Training  │ Total        │
│     12       │ Outreach: 8  │     4        │ Attendees    │
│              │              │              │    1,250     │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Metrics Calculated:**
- Total outreach events in date range
- Public outreach events count
- Law enforcement training events count
- Total individuals trained/reached (sum of all attendees)

## IPC Channels

### Main Process Handlers
```typescript
GET_ALL_PUBLIC_OUTREACH
  Returns: PublicOutreach[]

GET_PUBLIC_OUTREACH
  Params: id (number)
  Returns: PublicOutreach | null

ADD_PUBLIC_OUTREACH
  Params: { date, location, numAttendees, isLawEnforcement, notes }
  Returns: { success: boolean, outreach: PublicOutreach }

UPDATE_PUBLIC_OUTREACH
  Params: id (number), { date, location, numAttendees, isLawEnforcement, notes }
  Returns: { success: boolean }

DELETE_PUBLIC_OUTREACH
  Params: id (number)
  Returns: { success: boolean }
```

### Preload API
```typescript
window.electronAPI.getAllPublicOutreach()
window.electronAPI.getPublicOutreach(id)
window.electronAPI.addPublicOutreach(data)
window.electronAPI.updatePublicOutreach(id, data)
window.electronAPI.deletePublicOutreach(id)
```

## UI Components

### Pages
- `OutreachList.tsx` - List/grid view with filters
- `OutreachForm.tsx` - Add/Edit form

### Styling
- Green theme (`#39FFA0`) for Public Outreach
- Cyan theme (`#00D4FF`) for Law Enforcement Training
- Follows Neon Midnight color scheme
- Responsive grid layouts
- Hover effects and transitions

## User Workflows

### Log a Public Outreach Event
1. Click "Public Outreach" in sidebar
2. Click "Log New Event"
3. Fill in date, location, attendee count
4. Leave checkbox unchecked
5. Optionally add notes
6. Click "Log Event"
7. Success message appears
8. Redirects to list view

### Log a Law Enforcement Training
1. Click "Public Outreach" in sidebar
2. Click "Log New Event"
3. Fill in date, location, attendee count
4. **Check** "Law Enforcement Training" checkbox
5. Optionally add notes
6. Click "Log Event"
7. Success message appears
8. Redirects to list view

### Edit an Event
1. From list view, click "Edit" button
2. Modify fields as needed
3. Click "Update Event"
4. Success message appears
5. Redirects to list view

### Delete an Event
1. From list view, click "Delete" button
2. Confirm deletion in alert dialog
3. Event removed from list

### Generate Report with Outreach Data
1. From Dashboard, click "Generate Report"
2. Select date range
3. Click "Generate"
4. PDF includes "Public Outreach & Training" section
5. Shows all events in date range with statistics

## Data Validation

### Required Fields
- Date (must be valid date)
- Location (non-empty string)
- Number of Attendees (integer >= 1)

### Optional Fields
- Notes (any text)

### Business Logic
- Events can be edited or deleted at any time
- No constraints on future/past dates
- Attendee count must be positive integer
- Date filtering uses inclusive range (start date 00:00:00 to end date 23:59:59)

## Benefits

1. **Accountability** - Documents community engagement efforts
2. **Grant Reporting** - Provides metrics for federal grant requirements
3. **Impact Measurement** - Tracks reach and effectiveness
4. **Training Records** - Maintains LEO training documentation
5. **Historical Data** - Builds longitudinal dataset

## Future Enhancements (Not Implemented)

- Attach presentation materials/handouts
- Track specific topics/curricula covered
- Multi-presenter support
- Geographic mapping of coverage
- Feedback/survey integration
- Email confirmations
- Calendar integration

## Files Modified

1. `src/main/database.ts` - Added public_outreach table and index
2. `src/main/index.ts` - Added IPC handlers and report generation
3. `src/preload/index.ts` - Exposed outreach APIs
4. `src/shared/types.ts` - Added PublicOutreach interface and IPC channels
5. `src/renderer/App.tsx` - Added routes and API types
6. `src/renderer/components/Layout.tsx` - Added sidebar button and icon
7. `src/renderer/pages/OutreachList.tsx` - Created list view
8. `src/renderer/pages/OutreachForm.tsx` - Created add/edit form

## Testing Checklist

- [ ] Database table created on app start
- [ ] Sidebar button displays correctly with green icon
- [ ] List page loads and shows empty state
- [ ] "Log New Event" button navigates to form
- [ ] Form validates required fields
- [ ] Checkbox toggles between Public/LE Training
- [ ] Event type badge updates dynamically
- [ ] Form submits and creates event
- [ ] List page displays created event
- [ ] Statistics cards calculate correctly
- [ ] Filter buttons work (All/Public/LE)
- [ ] Edit button loads existing data
- [ ] Update saves changes
- [ ] Delete removes event with confirmation
- [ ] Dashboard report includes outreach section
- [ ] Report calculates totals correctly
- [ ] Date range filtering works in reports
