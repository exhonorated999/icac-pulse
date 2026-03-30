# Offense Reference Feature

## Overview
Added a comprehensive Offense Reference system that serves as a quick reference library for charges, sentencing ranges, and legal information.

## Purpose
Provides officers with instant access to charge information without having to search through penal codes or reference books. Especially useful during:
- Report writing
- Charging decisions  
- Warrant applications
- Court proceedings
- Training new officers

## Features

### 1. **Powerful Search**
- Search across all offense fields
- Finds matches in charge codes, descriptions, sentencing, and notes
- Supports single keywords (e.g., "manufacture", "record")
- Supports phrases (e.g., "hidden camera", "sexual exploitation")
- Highlights matching text in results
- Shows result count
- Clear button to reset search instantly
- Real-time filtering as you type

**Example Searches:**
- "311" - Finds all PC 311 offenses
- "manufacture" - Finds offenses involving manufacturing
- "hidden camera" - Finds offenses with that phrase
- "felony" - Shows all felony offenses
- "2, 3, or 4" - Finds offenses with that sentencing range

### 2. **Structured Offense Entries**
Each offense includes:
- **Charge Code** - e.g., "PC 311.11(a)", "PC 647.6(a)(1)"
- **Charge Description** - Full text of the offense
- **Seriousness Level** - Felony, Misdemeanor, Wobbler, or Infraction
- **Sentencing Range** - e.g., "2, 3, or 4 years", "Up to 1 year county jail"
- **Additional Notes** - Jury instructions, case law, elements, special conditions

### 3. **Drag-and-Drop Reordering**
- Click and drag any offense to reposition it
- Group related offenses together
- Custom order persists across sessions
- Visual drag handles on each card

### 4. **Color-Coded Seriousness**
- **Felony** - Red badge
- **Misdemeanor** - Yellow badge
- **Wobbler** - Purple badge
- **Infraction** - Blue badge

### 5. **Copy/Paste Friendly**
- All text fields support copy/paste
- Large text areas for detailed information
- Preserve formatting in notes field

### 6. **Easy-to-Read Layout**
- Card-based design
- Clear visual hierarchy
- Collapsible sections
- Prominent charge codes

## Database Schema

```sql
CREATE TABLE offense_reference (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  charge_code TEXT NOT NULL,
  charge_description TEXT NOT NULL,
  seriousness TEXT NOT NULL,
  sentencing_range TEXT,
  notes TEXT,
  display_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_offense_reference_seriousness ON offense_reference(seriousness);
CREATE INDEX idx_offense_reference_order ON offense_reference(display_order);
```

## File Structure

No files are stored - all data is in the database. This keeps the offense reference fast and searchable.

## User Interface

### Main Page
- **Header** with "Add Offense" button
- **Instructions** explaining drag-to-reorder
- **Offense Cards** in custom order with:
  - Drag handle (6 dots icon)
  - Charge code (large, bold)
  - Seriousness badge (color-coded)
  - Full description
  - Sentencing range (if provided)
  - Additional notes section (if provided)
  - Edit and Delete buttons

### Add/Edit Dialogs
- **Charge Code** - Text input (required)
- **Seriousness** - Dropdown (required)
  - Felony
  - Misdemeanor
  - Wobbler
  - Infraction
- **Charge Description** - Large textarea (required)
- **Sentencing Range** - Text input (optional)
- **Additional Notes** - Very large textarea (optional)

## Use Cases

### Example 1: Child Pornography Charges
```
Charge Code: PC 311.11(a)
Seriousness: Wobbler
Description: Possession of child pornography
Sentencing Range: 16 months, 2 years, or 3 years; OR up to 1 year county jail
Notes: CALCRIM 1140
- Must prove: (1) knowingly possessed, (2) matter depicted minor, (3) engaged in or simulating sexual conduct
- Each image is a separate count
- Registration required under PC 290
```

### Example 2: Enticement
```
Charge Code: PC 288.3(a)
Seriousness: Felony
Description: Contact or communication with minor with intent to commit specified offense
Sentencing Range: 16 months, 2 years, or 3 years
Notes: CALCRIM 1124
- Applies to PC 261, 264.1, 273a, 286, 287, 288, 288.2, 289, 311.1, 311.2, 311.11
- "Communication" includes electronic communication
- Intent must be proven at time of contact
```

## Technical Implementation

### Backend (IPC Handlers)
- `ADD_OFFENSE` - Create new offense
- `GET_ALL_OFFENSES` - Retrieve all offenses (ordered)
- `GET_OFFENSE` - Retrieve single offense
- `UPDATE_OFFENSE` - Modify existing offense
- `DELETE_OFFENSE` - Remove offense
- `REORDER_OFFENSES` - Save new display order

### Frontend (React Component)
- `OffenseReference.tsx` - Full page component
- Drag-and-drop using HTML5 Drag API
- Form validation
- Real-time reordering with database sync

### Files Modified/Created
1. **src/main/database.ts** - Added offense_reference table
2. **src/main/index.ts** - Added 6 IPC handlers
3. **src/shared/types.ts** - Added IPC channel constants
4. **src/preload/index.ts** - Exposed offense methods
5. **src/renderer/pages/OffenseReference.tsx** - NEW (full page)
6. **src/renderer/App.tsx** - Added route
7. **src/renderer/components/Layout.tsx** - Added sidebar link and icon

## Sidebar Location

**Menu Order:**
1. Dashboard
2. Create Case
3. Public Outreach
4. Resources
5. **Offense Reference** ← NEW
6. All Cases
7. Settings

**Icon:** Red/pink gavel symbol with glow effect

## Workflow Examples

### Adding Common Charges on First Use
1. Click "Offense Reference" in sidebar
2. Click "Add Offense"
3. Enter PC 311.11(a) details
4. Add another for PC 288.3(a)
5. Add another for PC 288.2(a)
6. Continue adding frequently-used charges

### Reorganizing by Category
1. Drag all child pornography charges together
2. Group all enticement charges
3. Group all contact offenses
4. Order automatically saves

### Quick Reference During Report Writing
1. Open Offense Reference page
2. **Search for keyword** (e.g., "manufacture")
3. See highlighted matches instantly
4. Copy charge description
5. Paste into report
6. Reference sentencing range
7. Check notes for elements

### Finding Specific Charges
1. Type partial code (e.g., "311")
2. See all matching PC 311 offenses
3. Or search by crime type (e.g., "hidden camera")
4. Results highlight matching text

## Benefits

### For Officers
- **Time Savings** - No more searching through penal code books
- **Accuracy** - Copy exact language from reference
- **Consistency** - Everyone uses same charge descriptions
- **Training** - New officers can learn charges
- **Court Ready** - Sentencing ranges at fingertips

### For Units
- **Standardization** - Consistent charging across unit
- **Knowledge Base** - Institutional knowledge preserved
- **Efficiency** - Faster report writing
- **Quality** - Fewer charging errors

## Future Enhancements

Potential improvements:

1. **Search Functionality** - Search by code, keyword, or description
2. **Categories** - Group by crime type (CP, enticement, contact, etc.)
3. **Export** - Export offense list to PDF or Word
4. **Import** - Bulk import from CSV or template
5. **Related Offenses** - Link related charges together
6. **Case Law** - Add section for relevant case law citations
7. **Statute History** - Track changes to laws over time
8. **Print View** - Printer-friendly reference sheet
9. **Tags** - Tag offenses for better organization
10. **Templates** - Pre-built sets for different case types

## Usage Tips

### Best Practices
1. Add offenses you use most frequently first
2. Group related charges together
3. Use notes field for jury instructions
4. Include elements of the offense in notes
5. Update sentencing when laws change
6. Copy/paste from official sources
7. Include registration requirements in notes

### Recommended Offenses to Add
- PC 311.11(a) - Possession of CP
- PC 311.1(a) - Production of CP
- PC 311.2(a) - Distribution of CP
- PC 311.3 - Sexual exploitation of child
- PC 311.4(b) - Employment of minor to perform
- PC 288.3(a) - Contact with intent
- PC 288.4(a)(1) - Arrangement of meeting
- PC 288.2(a) - Distribution of harmful matter
- PC 647.6(a) - Annoying or molesting child
- PC 288(a) - Lewd act on child under 14
- PC 288.5 - Continuous sexual abuse

## Notes

- No file storage - all data in database
- Display order persists across app restarts
- Drag-and-drop works on desktop only
- All text fields support copy/paste
- Notes field preserves line breaks

## Testing Checklist

After building, test:

- [ ] Navigate to Offense Reference page
- [ ] Click "Add Offense"
- [ ] Fill in all required fields
- [ ] Add offense with notes
- [ ] Verify offense appears in list
- [ ] **Test search bar:**
  - [ ] Type "manufacture" - see matching offenses
  - [ ] Type "311" - see all PC 311 charges
  - [ ] Type "hidden camera" - see phrase matches
  - [ ] Verify matching text is highlighted
  - [ ] Check result count is displayed
  - [ ] Click X to clear search
  - [ ] Try search with no results
- [ ] Test drag-and-drop reordering
- [ ] Verify order persists after refresh
- [ ] Click "Edit" on an offense
- [ ] Update fields and save
- [ ] Copy text from description field
- [ ] Paste text into notes field
- [ ] Delete an offense
- [ ] Add offense with only required fields
- [ ] Verify color coding by seriousness

## Support

**Location in App:** Sidebar → Offense Reference  
**Database Table:** `offense_reference`  
**Component:** `src/renderer/pages/OffenseReference.tsx`

---

## End of Documentation

This feature is ready for building and testing.
