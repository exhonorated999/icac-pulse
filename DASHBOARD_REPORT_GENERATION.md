# Dashboard Report Generation Feature

## Overview

Fully functional dashboard report generation system that creates beautiful, branded PDF reports covering case statistics for any date range.

## Features

### Report Statistics

The generated report includes:

1. **Key Metrics (4 Large Cards):**
   - Total New Cases (during period)
   - Warrants Issued (during period)
   - Arrests Made (during period)
   - Cases Closed (during period)

2. **Case Type Distribution:**
   - CyberTip count
   - P2P count
   - Chat count
   - Other count

3. **Case Status Distribution:**
   - Open cases
   - Waiting on Warrants
   - Ready for Residential
   - Arrested

### Branding & Layout

**Header:**
- ICAC P.U.L.S.E. logo with gradient text effect
- "Dashboard Report" subtitle
- Cyan glowing border

**Date Range Banner:**
- Prominent display of selected date range
- Cyan background highlight

**Footer:**
- Left: "Prepared by: [Username]"
- Right: "[Date] at [Time]"

## Visual Design

### Color Scheme

Matches the application's neon cyberpunk theme:
- **Background:** Dark navy gradient (#0B1120 to #1a2332)
- **Container:** Secondary dark with cyan border
- **Primary Accent:** Cyan (#00D4FF)
- **Alert/Arrests:** Pink (#FF2A6D)
- **Warning/Warrants:** Yellow (#FFB800)
- **Success/Closed:** Green (#39FFA0)
- **Text:** Off-white (#E0E0FF)
- **Muted Text:** Gray-blue (#94A3C0)

### Layout Elements

1. **Stats Grid (2x2):**
   - Large 48px numbers
   - Color-coded backgrounds
   - Glowing borders
   - Gradient overlays

2. **Breakdown Grids (4 columns):**
   - Compact cards with 28px numbers
   - Uniform spacing
   - Subtle backgrounds

3. **Section Titles:**
   - Cyan colored
   - Bottom border accent
   - Clear hierarchy

## User Flow

1. **Click "Generate Report"** button on dashboard
2. **Select Date Range** in modal dialog
   - Start date picker
   - End date picker
   - Validation ensures start < end
3. **Report Generates:**
   - Queries database for date range statistics
   - Renders HTML with inline CSS
   - Converts to PDF using Electron print-to-PDF
   - Saves to Desktop
4. **Auto-opens** folder containing PDF
5. **Dialog closes** and resets

## Technical Implementation

### Frontend (Dashboard.tsx)

```tsx
const handleGenerateReport = async () => {
  if (!reportDateFrom || !reportDateTo) {
    alert('Please select both start and end dates');
    return;
  }

  const fromDate = new Date(reportDateFrom);
  const toDate = new Date(reportDateTo);

  if (fromDate > toDate) {
    alert('Start date must be before end date');
    return;
  }

  setGeneratingReport(true);

  try {
    await window.electronAPI.generateDashboardReport({
      dateFrom: reportDateFrom,
      dateTo: reportDateTo
    });

    setShowReportDialog(false);
    setReportDateFrom('');
    setReportDateTo('');
  } catch (error) {
    console.error('Failed to generate report:', error);
    alert(`Failed to generate report: ${error}`);
  } finally {
    setGeneratingReport(false);
  }
};
```

### Backend (index.ts)

**Database Queries:**
```typescript
// Cases in date range
const casesInRange = db.prepare(`
  SELECT * FROM cases 
  WHERE date(created_at) BETWEEN date(?) AND date(?)
  ORDER BY created_at DESC
`).all(dateFrom, dateTo);

// Warrants in date range
const warrantsInRange = db.prepare(`
  SELECT COUNT(*) as count FROM warrants 
  WHERE date(created_at) BETWEEN date(?) AND date(?)
`).get(dateFrom, dateTo);

// Filter by status and type
const arrestsInRange = casesInRange.filter(c => c.status === 'arrest').length;
const closedInRange = casesInRange.filter(c => c.status === 'closed_no_arrest').length;
```

**PDF Generation:**
```typescript
// Create hidden BrowserWindow
const printWindow = new BrowserWindow({
  show: false,
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true
  }
});

// Load HTML
await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

// Wait for rendering
await new Promise(resolve => setTimeout(resolve, 500));

// Generate PDF
const pdfData = await printWindow.webContents.printToPDF({
  printBackground: true,
  margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
});

// Save to Desktop
fs.writeFileSync(filePath, pdfData);

// Open folder
shell.showItemInFolder(filePath);
```

### File Naming

```
Dashboard_Report_[YYYY-MM-DD]_to_[YYYY-MM-DD].pdf
```

Example: `Dashboard_Report_2025-01-01_to_2025-01-31.pdf`

### Save Location

Reports are saved to the user's Desktop for easy access.

## IPC Communication

### Channel
`GENERATE_DASHBOARD_REPORT`

### Request Data
```typescript
{
  dateFrom: string,  // YYYY-MM-DD format
  dateTo: string     // YYYY-MM-DD format
}
```

### Response
```typescript
{
  success: boolean,
  filePath: string   // Full path to generated PDF
}
```

## Files Modified

1. **src/shared/types.ts**
   - Added `GENERATE_DASHBOARD_REPORT` to IPC_CHANNELS

2. **src/preload/index.ts**
   - Added `generateDashboardReport()` method to electronAPI

3. **src/main/index.ts**
   - Added IPC handler for report generation
   - Implements HTML rendering and PDF conversion
   - Handles file system operations

4. **src/renderer/pages/Dashboard.tsx**
   - Already had UI and `handleGenerateReport()` function
   - Now fully functional with backend support

## HTML Template Features

### Responsive Design
- Uses CSS Grid for layouts
- Adapts to print media
- Preserves backgrounds and colors

### Print Optimization
- Proper margins (0.5 inch all sides)
- Background colors enabled
- Page-friendly dimensions
- No page breaks in sections

### Visual Effects
- Gradient backgrounds
- Glowing borders
- Color-coded sections
- Professional typography
- Box shadows (visible on screen, omitted in print)

## Statistics Calculations

### Date Range Filtering
All queries filter by `created_at` date:
```sql
WHERE date(created_at) BETWEEN date(?) AND date(?)
```

### Aggregations
- **New Cases:** COUNT of all cases in range
- **Warrants:** COUNT of warrants created in range
- **Arrests:** COUNT of cases with status='arrest' in range
- **Closed:** COUNT of cases with status='closed_no_arrest' in range
- **By Type:** GROUP BY case_type
- **By Status:** GROUP BY status

## Error Handling

1. **Date Validation:**
   - Both dates required
   - Start date must be before end date
   - Clear error messages

2. **Database Errors:**
   - Try-catch wraps all queries
   - Errors logged to console
   - User-friendly error alerts

3. **PDF Generation Errors:**
   - BrowserWindow failures caught
   - File write errors handled
   - Window cleanup guaranteed

## User Experience

### Loading State
- "Generating..." button text during generation
- Button disabled while processing
- Dialog remains open until success

### Success Feedback
- Dialog closes automatically
- Folder opens showing new PDF
- Fields reset for next report

### Professional Output
- Matches app branding perfectly
- Clean, modern design
- Executive-ready presentation
- Print-friendly format

## Future Enhancements

Potential additions:
- [ ] Charts/graphs (case trends over time)
- [ ] Comparison with previous period
- [ ] Export to Excel option
- [ ] Email report functionality
- [ ] Custom logo upload
- [ ] Configurable metrics
- [ ] Multi-page reports with case details
