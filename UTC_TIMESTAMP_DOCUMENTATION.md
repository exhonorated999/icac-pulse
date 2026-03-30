# UTC Timestamp Documentation

## Overview
All timestamps in ICAC P.U.L.S.E. are stored and handled in **UTC (Coordinated Universal Time)** to prevent timezone confusion when sharing data between investigators, agencies, or across different time zones.

## Implementation

### SQLite Database
SQLite's `CURRENT_TIMESTAMP` function returns UTC time by default. All tables using this are UTC-compliant.

**Example:**
```sql
CREATE TABLE cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- UTC
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP   -- UTC
);
```

### JavaScript/TypeScript
When manually inserting timestamps, we use `Date.toISOString()` which always returns UTC in ISO 8601 format.

**Example:**
```typescript
const timestamp = new Date().toISOString();
// Returns: "2024-12-01T15:30:45.123Z" (the 'Z' indicates UTC)
```

## Tables with Timestamps

### Automatic Timestamps (CURRENT_TIMESTAMP)
These tables use SQLite's `CURRENT_TIMESTAMP` and are automatically UTC:

1. **users**
   - `created_at`
   - `last_login`

2. **cases**
   - `created_at`
   - `updated_at`

3. **public_outreach**
   - `created_at`
   - `updated_at`

4. **case_notes**
   - `created_at`

5. **evidence**
   - `uploaded_at`

6. **case_reports**
   - `updated_at`

7. **probable_cause**
   - `updated_at`

8. **todos**
   - `created_at`
   - `completed_at`

### Manual Timestamps (User-Provided Dates)
These are dates entered by users and may represent local time events:

1. **cybertip_data**
   - `report_date` - Date of NCMEC report
   - `occurrence_date` - Date incident occurred
   - `date_received_utc` - Already marked as UTC

2. **p2p_data**
   - `download_date` - Date files were downloaded

3. **chat_data**
   - `initial_contact_date` - Date chat began

4. **warrants**
   - `date_issued` - Date warrant was issued
   - `date_served` - Date warrant was served
   - `date_due` - Date warrant return is due
   - `date_received` - Date data was received

5. **public_outreach**
   - `date` - Date of event (user enters local date)

6. **operations_plans**
   - `approval_date` - Date plan was approved
   - `execution_date` - Date operation was executed

## Display Considerations

### When Displaying Timestamps

**For Automatic System Timestamps:**
Convert from UTC to user's local time for display:
```typescript
const localDate = new Date(utcTimestamp).toLocaleString();
// or
const localDate = new Date(utcTimestamp).toLocaleDateString();
```

**For User-Entered Dates:**
These are already in the user's context and can be displayed as-is:
```typescript
// These represent "the date the event occurred" not a specific moment
const displayDate = new Date(userDate).toLocaleDateString();
```

## Best Practices

### 1. System-Generated Timestamps
✅ **Always use CURRENT_TIMESTAMP or Date.toISOString()**
```typescript
// Good
db.run('INSERT INTO cases (...) VALUES (...)'); // created_at auto-populated

// Good
const completedAt = new Date().toISOString();
db.run('UPDATE todos SET completed_at = ? WHERE id = ?', [completedAt, id]);
```

❌ **Never use local time functions**
```typescript
// Bad
const timestamp = new Date().toString(); // Local timezone
const timestamp = Date.now(); // Milliseconds, not ISO format
```

### 2. User Date Inputs
For dates like "when did this event occur", store the date string as entered:
```typescript
// User enters: "2024-12-01"
// Store as: "2024-12-01" (no time component needed)
```

### 3. File Naming with Timestamps
Use UTC timestamps in filenames for consistency:
```typescript
const filename = `Case_${caseNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
// Results in: Case_12345_2024-12-01.pdf
```

### 4. Displaying Times
Always convert to local time for user display:
```typescript
// In React components
const displayTime = new Date(utcTimestamp).toLocaleString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short'
});
// Shows: "December 1, 2024, 10:30 AM EST"
```

## Verification

### Check if a Timestamp is UTC
```typescript
// UTC timestamps end with 'Z' or have timezone offset
"2024-12-01T15:30:45.123Z"  // ✅ UTC
"2024-12-01T15:30:45+00:00" // ✅ UTC
"2024-12-01T15:30:45"       // ⚠️ Ambiguous (no timezone)
```

### SQLite UTC Verification
```sql
-- Check current SQLite time (should be UTC)
SELECT datetime('now');  -- Returns UTC time

-- Check a timestamp value
SELECT datetime(created_at) FROM cases WHERE id = 1;
```

## Migration Notes

### Existing Data
All existing timestamps in the database are already UTC because:
1. SQLite's `CURRENT_TIMESTAMP` has always returned UTC
2. Manual timestamps used `Date.toISOString()` which is UTC

### No Migration Needed
No data migration is required. The system has been UTC-compliant since inception.

## Common Scenarios

### Scenario 1: Case Created
```typescript
// Database stores UTC automatically
INSERT INTO cases (case_number, ..., created_at) 
VALUES ('12345', ..., CURRENT_TIMESTAMP);
// created_at = "2024-12-01 20:30:45" (UTC)

// Display converts to local
// User in EST sees: "Dec 1, 2024, 3:30 PM EST"
// User in PST sees: "Dec 1, 2024, 12:30 PM PST"
```

### Scenario 2: Warrant Due Date
```typescript
// User enters: "2024-12-15" (their local concept of the date)
// Database stores: "2024-12-15" (as text, represents "that calendar day")
// Display shows: "December 15, 2024" (same everywhere)
```

### Scenario 3: Todo Completed
```typescript
// User completes todo at 3:45 PM local time (EST)
const completedAt = new Date().toISOString(); // "2024-12-01T20:45:00.000Z"
db.run('UPDATE todos SET completed_at = ?', [completedAt]);

// Display shows: "Dec 1, 2024, 3:45 PM EST" (converted back to local)
```

### Scenario 4: Public Outreach Event
```typescript
// User enters event date: "2024-12-01"
// This represents "December 1st" as a calendar date, not a specific moment
// Store as: "2024-12-01"
// Display as: "December 1, 2024" (same interpretation everywhere)
```

## Report Generation

### Dashboard Reports
When generating reports with date ranges:
```typescript
const fromDate = new Date(dateFrom); // Start of day in UTC
const toDate = new Date(dateTo);
toDate.setHours(23, 59, 59, 999); // End of day in UTC

// Filter includes all events within the UTC day boundaries
```

### PDF Timestamps
Reports include generation timestamp in local time for reader convenience:
```typescript
const reportTime = new Date().toLocaleString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});
// Shows: "December 1, 2024 at 03:30 PM"
```

## Benefits of UTC

1. **No Timezone Confusion** - Everyone sees the same absolute time
2. **Daylight Saving Time** - No issues with DST transitions
3. **Data Sharing** - Can share with other agencies without ambiguity
4. **Legal Accuracy** - Court documents need precise timestamps
5. **International Cooperation** - Works across countries
6. **Historical Data** - Past records remain accurate even if timezone rules change

## Tools for Verification

### Check System Time
```bash
# Windows PowerShell
Get-Date -Format o
# Shows local time with UTC offset: "2024-12-01T15:30:45.1234567-05:00"

# Check UTC time
[System.DateTime]::UtcNow.ToString("o")
# Shows: "2024-12-01T20:30:45.1234567Z"
```

### SQLite Console
```sql
-- Check SQLite's current UTC time
SELECT datetime('now');

-- Check a specific timestamp
SELECT datetime(created_at), created_at FROM cases WHERE id = 1;
```

## Summary

✅ **All system-generated timestamps are UTC**
✅ **User-entered dates are stored as calendar dates**
✅ **Display converts UTC to local time automatically**
✅ **No manual timezone handling needed in code**
✅ **Legal and sharing requirements met**

The system is fully UTC-compliant and requires no changes to timestamp handling.
