# DA Case Export Feature

## Overview
Complete case export functionality for sharing with District Attorneys. Exports all relevant case materials to external media (USB drives, external hard drives, CDs, etc.).

## Feature Description

### Export Button Location
- **Position:** Case Detail page header, next to "Edit" button
- **Label:** "Export DA Case"
- **Icon:** Download arrow
- **Visibility:** Always visible (not dependent on edit mode)
- **State:** Shows spinner and "Exporting..." text during export

### Exported Content

The export includes all materials relevant for prosecution:

#### 1. CyberTip Files (CyberTip cases only)
- **Source:** `cases/[CaseNumber]/cybertip/`
- **Destination:** `1_CyberTip_Files/`
- **Contents:**
  - NCMEC report PDFs
  - All uploaded NCMEC folders
  - Evidence files from CyberTip
  - Complete folder structure preserved

#### 2. Search Warrants
- **Source:** `cases/[CaseNumber]/warrants/`
- **Destination:** `2_Search_Warrants/`
- **Contents:**
  - All warrant PDFs (e.g., `Facebook_2024-11-25_warrant.pdf`)
  - All warrant return folders (e.g., `Facebook_2024-11-25_return/`)
  - Complete data returns from service providers
  - Organized by company and date

#### 3. Case Notes
- **Source:** Database `case_notes` table
- **Destination:** `3_Case_Notes/Case_Notes.txt`
- **Format:**
  ```
  Case Notes - Case [CaseNumber]
  Generated: [Date and Time]
  Total Notes: [Count]
  ================================================================================
  
  Note #1 - [DateTime]
  --------------------------------------------------------------------------------
  [Note content]
  
  Note #2 - [DateTime]
  --------------------------------------------------------------------------------
  [Note content]
  ```
- **Features:**
  - Chronological order (oldest first)
  - Timestamps for each note
  - Plain text format (readable on any system)
  - Numbered entries

#### 4. Evidence Files
- **Source:** `cases/[CaseNumber]/evidence/`
- **Destination:** `4_Evidence/`
- **Contents:**
  - All uploaded evidence files
  - All uploaded evidence folders
  - Cell phone extractions
  - Forensic reports
  - Triage documents
  - Complete folder structure preserved

#### 5. README File
- **Location:** Root of export folder
- **Filename:** `README.txt`
- **Contents:**
  - Case number and type
  - Export date and time
  - Exported by (officer name)
  - Contents description
  - Important handling notes
  - Data sensitivity warning

### Export Folder Structure

```
Case_[CaseNumber]_DA_Export/
│
├── README.txt
│
├── 1_CyberTip_Files/ (if CyberTip case)
│   ├── ncmec_report.pdf
│   ├── NCMEC_12345678/
│   └── evidence_files/
│
├── 2_Search_Warrants/
│   ├── Facebook_2024-11-25_warrant.pdf
│   ├── Facebook_2024-11-25_return/
│   ├── Google_2024-11-26_warrant.pdf
│   └── Google_2024-11-26_return/
│
├── 3_Case_Notes/
│   └── Case_Notes.txt
│
└── 4_Evidence/
    ├── cell_extraction_report.pdf
    ├── forensic_analysis/
    └── witness_statements/
```

## User Workflow

### Step-by-Step Process

```
1. Detective opens case detail page
   ↓
2. Clicks "Export DA Case" button
   ↓
3. Confirmation dialog appears:
   - Lists what will be exported
   - Explains destination selection
   - Confirms continuation
   ↓
4. Detective clicks "OK"
   ↓
5. Folder selection dialog appears:
   - Title: "Select Export Destination (USB Drive, External Drive, etc.)"
   - Shows drives and folders
   - Detective selects destination (e.g., E:\ USB drive)
   ↓
6. System checks if folder exists:
   - If exists: Shows overwrite confirmation
   - If new: Proceeds to export
   ↓
7. Export process executes:
   - Creates folder: Case_[Number]_DA_Export
   - Copies all relevant files
   - Preserves folder structures
   - Creates README.txt
   - Maintains timestamps
   ↓
8. Export completes:
   - Success dialog shows:
     * Export location
     * Number of files copied
     * Success message
   - Folder opens automatically
   ↓
9. Detective can:
   - Review exported files
   - Safely eject USB drive
   - Deliver to District Attorney
```

## Technical Implementation

### Frontend (CaseDetail.tsx)

**State Management:**
```typescript
const [exporting, setExporting] = useState(false);
```

**Export Handler:**
```typescript
const handleExportCase = async () => {
  // 1. Show confirmation
  // 2. Call IPC handler
  // 3. Handle success/error
  // 4. Show results
  // 5. Reset state
};
```

**Button UI:**
- Shows spinner during export
- Disabled while exporting
- Clear icon and label
- Success/error feedback

### Backend (index.ts)

**IPC Handler:** `EXPORT_DA_CASE`

**Process Flow:**
1. **Destination Selection:**
   - Shows open dialog (directory only)
   - User selects USB/external drive
   - Validates selection

2. **Folder Creation:**
   - Creates export folder with case number
   - Checks for existing folder
   - Handles overwrite confirmation

3. **File Copying:**
   - Recursive directory copy
   - Preserves structure
   - Maintains timestamps
   - Counts files

4. **Content Organization:**
   - Numbered folders (1_, 2_, 3_, 4_)
   - Clear naming conventions
   - Logical order for DA review

5. **Metadata Generation:**
   - README.txt with case info
   - Case notes as plain text
   - Export timestamp

6. **Completion:**
   - Opens export folder
   - Returns success with stats
   - Logs export details

### Helper Functions

**copyDirectory(src, dest):**
- Recursively copies directories
- Creates destination folders
- Copies all files
- Counts files
- Preserves structure

**README Generation:**
- Case metadata
- Export details
- Contents list
- Handling instructions
- Security warnings

## Security Considerations

### Data Sensitivity
- **Warning in README:** Reminds of sensitive nature
- **Agency Policies:** Encourages following protocols
- **Secure Transport:** Recommends encrypted drives
- **Access Control:** Only authorized personnel

### Data Integrity
- **Complete Copies:** All files copied fully
- **Timestamp Preservation:** Original dates maintained
- **Structure Preservation:** Folder organization intact
- **Verification:** File count provided

### Chain of Custody
- **Export Log:** Officer name recorded
- **Timestamp:** Exact export time
- **Case Number:** Clear identification
- **README:** Complete documentation

## Testing Checklist

### Basic Functionality
- [ ] Export button visible in case detail
- [ ] Button shows correct icon and label
- [ ] Confirmation dialog appears
- [ ] Destination selector works
- [ ] Folder creates successfully

### Content Export
- [ ] CyberTip files export (if applicable)
- [ ] Warrant PDFs export
- [ ] Warrant return folders export
- [ ] Case notes export as text
- [ ] Evidence files export
- [ ] Evidence folders export
- [ ] README file creates

### Folder Structure
- [ ] Export folder named correctly
- [ ] Numbered subfolders created
- [ ] Folder structure preserved
- [ ] Files in correct locations
- [ ] README in root

### Edge Cases
- [ ] Empty case (no files) handles gracefully
- [ ] CyberTip case vs. other types
- [ ] Large files copy successfully
- [ ] Deep folder structures work
- [ ] Special characters in filenames
- [ ] Existing folder overwrite works
- [ ] Cancelled export handles properly

### USB/External Media
- [ ] USB drive destination works
- [ ] External hard drive works
- [ ] Network drive works (if applicable)
- [ ] Folder opens after export
- [ ] Files accessible on destination

### Success Feedback
- [ ] File count accurate
- [ ] Export path correct
- [ ] Success message clear
- [ ] Folder opens automatically
- [ ] Can export same case multiple times

## Error Handling

### Possible Errors
1. **Destination not selected:** User cancels → Clean exit
2. **Insufficient space:** Alert user → Check space
3. **Permission denied:** Alert user → Check permissions
4. **File in use:** Alert user → Close applications
5. **Copy failure:** Alert user → Retry option

### Error Messages
- Clear description of problem
- Suggestions for resolution
- Option to retry
- Logs error details

## Performance Considerations

### Large Cases
- May take time for large files
- Progress indication (spinner)
- No UI blocking
- Async operations

### File Counting
- Accurate count provided
- Includes all files
- Excludes directories from count

## Future Enhancements (Optional)

### Possible Additions
1. **Progress Bar:** Show % complete for large exports
2. **Selective Export:** Choose which sections to export
3. **Export Log:** Database record of all exports
4. **Compression:** Option to create ZIP file
5. **Encryption:** Option to encrypt export folder
6. **Email Integration:** Email export notification
7. **Report Generation:** Auto-generate summary PDF

### Export Templates
- Standard DA package
- Court filing package
- Evidence-only export
- Notes-only export

## Usage Notes

### Best Practices
1. **Verify Contents:** Check exported folder before delivery
2. **Safe Removal:** Safely eject USB drives
3. **Label Media:** Label USB/CD with case number
4. **Secure Transport:** Use secure methods to deliver
5. **Retain Copy:** Keep original case data intact

### When to Export
- Case ready for prosecution
- DA requests case materials
- Court filing preparation
- Case transfer to another agency
- Archival purposes

### What's NOT Exported
- Database records (only exported data)
- Suspect photos (optional - can be added if needed)
- Operations plan (optional - can be added if needed)
- Prosecution records (DA creates their own)
- Application settings
- User information

## Support Information

### Common Questions

**Q: Can I export to multiple locations?**
A: Yes, click export multiple times, select different destinations each time.

**Q: Does export modify the original case?**
A: No, export only copies files. Original case remains untouched.

**Q: Can I export to a CD?**
A: Yes, if your system has CD burning software, you can export to a CD burner drive.

**Q: What format are the case notes?**
A: Plain text (.txt) file, readable on any computer.

**Q: How long does export take?**
A: Depends on case size. Small cases: seconds. Large cases: minutes.

**Q: Can I cancel during export?**
A: Not easily. The export is designed to complete quickly. If needed, you can close the app, but partial data may be copied.

## Documentation Files

Related documentation:
- `project_rules` - Overall project guidelines
- `COMPLETE_FEATURES_SUMMARY.md` - All features overview
- `DA_CASE_EXPORT_FEATURE.md` - This file
