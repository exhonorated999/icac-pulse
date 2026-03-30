# Suspect PDF Export Feature

## Overview

Professional, branded PDF export for suspect intelligence reports. Designed for use during search warrants to provide teams with comprehensive suspect information including photos.

## Purpose

Officers will use this during search warrants to:
- Brief team members on suspect identity
- Provide visual identification (photos)
- Alert team to weapons presence
- Share vehicle and residence information
- Ensure everyone knows who to look for

## Report Contents

### Header Section
- **ICAC P.U.L.S.E. branding** with gradient logo
- "Suspect Intelligence Report" subtitle
- Case number banner
- "LAW ENFORCEMENT SENSITIVE" alert banner

### Information Sections

1. **👤 Suspect Description**
   - First Name
   - Last Name
   - Date of Birth
   - Phone Number

2. **🏠 Residential Information**
   - Full Address
   - Place of Work

3. **🚗 Vehicle Information**
   - Vehicle Make
   - Vehicle Model
   - Vehicle Color

4. **⚠️ Weapons Registry** (if applicable)
   - List of all registered weapons
   - Red alert styling
   - "CAUTION" header

5. **📸 Suspect Photographs**
   - All uploaded suspect photos
   - 3-column grid layout
   - 200px height for clear viewing

6. **🚗 Vehicle Photographs**
   - All uploaded vehicle photos
   - 3-column grid layout
   - Page break before section

7. **🏠 Residence Photographs**
   - All uploaded residence photos
   - 4-column grid (more compact)
   - 150px height

### Footer
- Left: "Prepared by: [Officer Username]"
- Right: "[Date] at [Time]"

## Visual Design

### Color Scheme
- **Primary Alert:** Pink (#FF2A6D) - for borders, case number, weapons
- **Secondary:** Cyan (#00D4FF) - for section titles
- **Background:** Dark navy gradient
- **Text:** Off-white (#E0E0FF)

### Layout Features
- Professional card-based design
- Color-coded sections with icons
- Gradient backgrounds with glowing borders
- Print-optimized with page breaks
- High-resolution photo display

### Branding
- Matches ICAC P.U.L.S.E. application theme
- Gradient logo (cyan to pink)
- Cyberpunk aesthetic adapted for print
- Executive-quality presentation

## User Interface

### Export Button Location
**Suspect Tab** - Top right corner, next to Edit button

### Button Design
- Pink theme to indicate critical/important action
- Download icon
- "Export PDF" label
- Disabled state when no suspect data
- Loading state: "Exporting..."

### User Flow
1. Navigate to case → Suspect tab
2. Click "Export PDF" button
3. System generates PDF (takes 1-2 seconds for image loading)
4. PDF saves to Desktop as `Case_[CaseNumber]_Suspect_Report.pdf`
5. Folder opens automatically showing the file
6. Success alert confirms export

## Technical Implementation

### Frontend (SuspectTab.tsx)

```tsx
const handleExportPDF = async () => {
  if (!suspect) {
    alert('No suspect data to export');
    return;
  }

  setExporting(true);
  try {
    await window.electronAPI.exportSuspectPdf(caseId, caseNumber);
    alert('Suspect report exported successfully!');
  } catch (error) {
    console.error('Failed to export suspect PDF:', error);
    alert(`Failed to export PDF: ${error}`);
  } finally {
    setExporting(false);
  }
};
```

### Backend (index.ts)

**Database Queries:**
```typescript
// Get suspect data
const suspect = db.prepare('SELECT * FROM suspects WHERE case_id = ?').get(caseId);

// Get weapons
const weapons = db.prepare('SELECT * FROM weapons WHERE suspect_id = ?').all(suspect.id);

// Get photos grouped by category
const photos = db.prepare(`
  SELECT * FROM suspect_photos 
  WHERE suspect_id = ? 
  ORDER BY category, created_at
`).all(suspect.id);
```

**Image Processing:**
```typescript
const getImageBase64 = (photoPath: string) => {
  const fullPath = path.join(getCasesPath(), photoPath);
  const imageBuffer = fs.readFileSync(fullPath);
  const base64 = imageBuffer.toString('base64');
  const ext = path.extname(photoPath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mimeType};base64,${base64}`;
};
```

**PDF Generation:**
```typescript
// Create hidden BrowserWindow
const printWindow = new BrowserWindow({ show: false });

// Load HTML with embedded images
await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

// Wait for images to load
await new Promise(resolve => setTimeout(resolve, 1000));

// Generate PDF with small margins
const pdfData = await printWindow.webContents.printToPDF({
  printBackground: true,
  margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
});

// Save to Desktop
fs.writeFileSync(filePath, pdfData);

// Open folder
shell.showItemInFolder(filePath);
```

## File Naming

```
Case_[CaseNumber]_Suspect_Report.pdf
```

Example: `Case_2025-001_Suspect_Report.pdf`

## Save Location

Desktop - for immediate access during briefings

## Image Handling

### Photo Embedding
- All photos converted to base64 data URIs
- Embedded directly in HTML (no external dependencies)
- Preserves image quality
- Works offline

### Photo Layout
- **Suspect Photos:** 3 columns, 200px height
- **Vehicle Photos:** 3 columns, 200px height
- **Residence Photos:** 4 columns, 150px height (more compact)

### Page Breaks
- Vehicle photos start on new page
- Residence photos start on new page if no vehicle photos
- Prevents awkward splits of photo sections

## Use Cases

### Pre-Warrant Briefing
- Print copies for all team members
- Review suspect appearance
- Identify vehicles to look for
- Note residence features
- Alert team to weapons

### Tactical Planning
- Visual reference during approach
- Identify escape vehicles
- Recognize suspect on sight
- Coordinate surveillance positions

### Inter-Agency Sharing
- Professional format for sharing with other departments
- All critical information in one document
- Photos for positive identification
- Contact information included

## Error Handling

### No Suspect Data
- Alert: "No suspect data to export"
- Export button disabled
- Prevents empty reports

### Missing Photos
- Sections only shown if photos exist
- No empty photo grids
- Clean presentation even without images

### Image Load Failures
- Graceful handling of missing image files
- Continues export with available images
- Logs errors to console

## Security Considerations

### Sensitive Information Banner
Large alert banner at top:
```
⚠️ LAW ENFORCEMENT SENSITIVE ⚠️
This document contains confidential suspect information
for authorized personnel only
```

### Weapons Alert
Special styling for weapons section:
- Red/pink color scheme
- "CAUTION" header
- Prominent bullet points
- High visibility

### Footer Accountability
- Officer name on every page
- Date and time of export
- Creates audit trail
- Professional attribution

## Print Optimization

### PDF Settings
- A4/Letter compatible
- 0.4 inch margins
- Background colors enabled
- High quality image rendering

### Page Layout
- Sections grouped logically
- Strategic page breaks
- No orphaned content
- Printer-friendly design

## Benefits

1. **Professional Presentation**
   - Branded, executive-quality output
   - Consistent with application design
   - Print-ready format

2. **Operational Efficiency**
   - All info in one document
   - Quick reference during operations
   - Easy to distribute to team

3. **Safety Enhancement**
   - Weapons alerts prominent
   - Visual identification available
   - Complete suspect profile

4. **Information Completeness**
   - Demographics
   - Locations
   - Vehicles
   - Visual identification
   - Weapons status

## Future Enhancements

Potential additions:
- [ ] QR code linking to digital case file
- [ ] Multiple suspects per case
- [ ] Known associates section
- [ ] Criminal history summary
- [ ] Social media profiles section
- [ ] Email report directly to team
- [ ] Print directly from app
- [ ] Watermark with classification level
