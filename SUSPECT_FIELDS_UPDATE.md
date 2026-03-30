# Suspect Information Fields Update

## Overview

Added comprehensive physical description fields to the suspect information system, including all critical identifying characteristics needed for field operations.

## New Fields Added

### Database Schema

Added two new columns to the `suspects` table:
- `hair_color` TEXT - Suspect's hair color
- `eye_color` TEXT - Suspect's eye color
- `place_of_work` TEXT - Consistent naming (already had workplace)

### Complete Suspect Fields

**Personal Information:**
1. First Name
2. Last Name
3. Date of Birth
4. Phone Number
5. Driver's License Number

**Physical Description:**
6. Height (e.g., "5'10"")
7. Weight (e.g., "180 lbs")
8. Hair Color (e.g., "Brown", "Black", "Blonde")
9. Eye Color (e.g., "Blue", "Brown", "Green")

**Location Information:**
10. Address (Residence)
11. Place of Work

**Vehicle Information:**
12. Vehicle Make
13. Vehicle Model
14. Vehicle Color

**Safety Information:**
15. Weapons Registry (with descriptions)

## User Interface Updates

### Suspect Tab Layout

Fields are arranged in a responsive 2-column grid:

**Row 1:**
- First Name | Last Name

**Row 2:**
- Date of Birth | Phone Number

**Row 3:**
- Driver's License Number | Height

**Row 4:**
- Weight | Hair Color

**Row 5:**
- Eye Color | (empty)

**Full Width:**
- Residence Address (with photos)
- Place of Work

**Vehicle Section:**
- Vehicle Make | Vehicle Model
- Vehicle Color (full width)

### Form Behavior

**View Mode:**
- All fields display with "N/A" if empty
- Clean, readable layout
- Photos displayed in grids

**Edit Mode:**
- All fields editable with text inputs
- Placeholders for guidance (e.g., "5'10"" for height)
- Date picker for DOB
- Save/Cancel buttons

## PDF Export Updates

### Suspect Description Section

Now includes 9 fields in a grid layout:
- First Name
- Last Name
- Date of Birth
- Phone Number
- Driver's License ✨ NEW
- Height ✨ NEW
- Weight ✨ NEW
- Hair Color ✨ NEW
- Eye Color ✨ NEW

### Visual Layout

The PDF automatically arranges fields in a professional grid:
- 2 columns for optimal readability
- Color-coded sections
- Clear labels in caps with proper spacing
- All values prominently displayed

## Database Migration

### Automatic Migration

On app startup, the system checks for missing columns and adds them:

```typescript
// Check if columns exist
const suspectColumns = db.exec("PRAGMA table_info(suspects)");
const suspectColumnNames = suspectColumns[0].values.map(row => row[1]);

// Add hair_color if missing
if (!suspectColumnNames.includes('hair_color')) {
  db.run('ALTER TABLE suspects ADD COLUMN hair_color TEXT');
}

// Add eye_color if missing
if (!suspectColumnNames.includes('eye_color')) {
  db.run('ALTER TABLE suspects ADD COLUMN eye_color TEXT');
}

// Add place_of_work if missing
if (!suspectColumnNames.includes('place_of_work')) {
  db.run('ALTER TABLE suspects ADD COLUMN place_of_work TEXT');
}
```

### Safe Migration

- Non-destructive: only adds columns if they don't exist
- Preserves all existing data
- Runs automatically on app start
- Backwards compatible

## Operational Benefits

### For Field Officers

**Complete Physical Description:**
- Height and weight for size estimation
- Hair and eye color for quick identification
- Driver's license for verification

**Enhanced Identification:**
- Multiple identifying characteristics
- Professional appearance in reports
- Easy reference during operations

### For Tactical Teams

**Pre-Operation Briefing:**
- Complete suspect profile
- Physical characteristics clearly listed
- Professional PDF for distribution

**During Operations:**
- Quick reference for positive ID
- All critical info on one page
- Photos plus written description

## Use Cases

### Search Warrant Briefings
Officers can now provide:
- Complete physical description
- Height/weight for door breach planning
- Hair/eye color for positive identification
- Driver's license for verification

### Surveillance Operations
Teams have:
- Detailed description for spotting
- Multiple identifiers to confirm suspect
- Professional documentation

### Inter-Agency Coordination
Sharing suspect info includes:
- Professional formatted report
- All standard LEO fields
- Photos with complete description

## Technical Implementation

### Files Modified

1. **src/main/database.ts**
   - Added migrations for hair_color and eye_color
   - Added place_of_work column check

2. **src/renderer/components/SuspectTab.tsx**
   - Added fields to Suspect interface
   - Updated formData state
   - Added 5 new form fields with proper layout
   - Updated save/load logic

3. **src/main/index.ts** (PDF Export)
   - Updated suspect description section
   - Added 5 new fields to PDF output
   - Maintains professional grid layout

## Field Validation

### Optional Fields
All fields are optional - officers can:
- Fill in what's known
- Leave unknowns as "N/A"
- Update as information becomes available

### Placeholders
Helpful examples shown in edit mode:
- Height: "e.g. 5'10""
- Weight: "e.g. 180 lbs"
- Hair Color: "e.g. Brown"
- Eye Color: "e.g. Blue"

## Data Persistence

### Storage
- All fields stored in SQLite database
- Encrypted with hardware-bound key
- Backed up with case data

### Updates
- Real-time save on form submit
- Immediate reflection in PDF exports
- Version tracked with updated_at timestamps

## Future Enhancements

Potential additions:
- [ ] Build/body type dropdown
- [ ] Scars/marks/tattoos section
- [ ] Race/ethnicity field
- [ ] Facial hair descriptor
- [ ] Glasses/contacts indicator
- [ ] Known aliases section
- [ ] Physical disabilities notes

## Benefits Summary

**Completeness:**
✅ All standard LEO identification fields
✅ Professional appearance
✅ Easy to read and reference

**Usability:**
✅ Simple input form
✅ Helpful placeholders
✅ Automatic migration

**Operational:**
✅ Enhanced suspect identification
✅ Better team coordination
✅ Professional documentation
