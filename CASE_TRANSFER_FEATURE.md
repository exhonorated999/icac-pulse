# Case Transfer Feature - Complete Implementation

## Purpose
Allow detectives to transfer complete cases between ICAC P.U.L.S.E. installations when team members change, retire, or cases are reassigned.

## Key Requirements

### Export
- **Button Location:** Case detail page, next to "Export DA Case"
- **Package Format:** Encrypted ZIP file (`Case_[Number]_Transfer.pulse`)
- **Password Protection:** User sets password during export
- **Size Warning:** Warn if >7GB about processing time
- **Progress Indicator:** Animated progress with file count
- **Save Location:** User chooses where to save (dialog picker)
- **Security Warning:** Display warning about sensitive data handling

### Import
- **Button Location:** Dashboard, next to "Create New Case"
- **Password Required:** Must enter password to decrypt
- **Conflict Handling:** If case number exists, offer:
  - Rename (suggest: [CaseNumber]-TRANSFER)
  - Overwrite (requires confirmation)
  - Cancel
- **Progress Indicator:** Step-by-step progress display
- **Partial Failure Handling:** Offer choice:
  - Start over (rollback)
  - Proceed with partial import
- **Verification:** Checksum verification of all files

## Package Structure

### File Format
`.pulse` file (encrypted ZIP)

### Contents
```
Case_[CaseNumber]_Transfer.pulse
├── manifest.json          // All database records + metadata
└── files/
    ├── cybertip/         // NCMEC PDFs, NCMEC folders
    ├── p2p_downloads/    // P2P download folders
    ├── evidence/         // Evidence files/folders
    ├── warrants/         // Warrant PDFs + return folders
    ├── suspect/          // Suspect photos
    ├── operations_plan/  // Ops plan PDF
    └── reports/          // Generated report PDFs
```

### Manifest.json Schema
```json
{
  "export_metadata": {
    "pulse_version": "1.0.0",
    "export_date": "2026-02-22T20:00:00Z",
    "exporting_officer": "Justin Moyer",
    "case_number": "2024-001"
  },
  "case": {
    // Complete case record
  },
  "notes": [],
  "identifiers": [],  // CyberTip
  "usernames": [],    // Chat
  "cybertip_files": [],
  "p2p_data": {},
  "warrants": [],
  "evidence": [],
  "suspect": {},
  "suspect_photos": [],
  "prosecution": {},
  "operations_plan": {},
  "report": {},
  "file_inventory": [
    {
      "path": "cybertip/ncmec_report.pdf",
      "size": 1234567,
      "checksum": "abc123..."
    }
  ]
}
```

## User Flows

### Export Flow
1. Detective opens case detail page
2. Clicks "Export PULSE File" button
3. **Security Warning Dialog:**
   - "This export contains highly sensitive case data"
   - "Use encrypted USB drive or secure file transfer"
   - "Delete from shared locations after transfer"
   - Checkbox: "I understand" (required)
4. **Password Setup Dialog:**
   - Enter password (min 8 chars)
   - Confirm password
   - Password strength indicator
5. **Save Location Dialog:**
   - Native file picker
   - Default filename: `Case_[Number]_Transfer.pulse`
6. **Export Progress:**
   - "Calculating package size..."
   - If >7GB: "⚠️ Large case detected. This may take several minutes."
   - "Gathering case data... (Step 1 of 4)"
   - "Copying files... (234 of 567 files)"
   - "Generating checksums... (Step 3 of 4)"
   - "Encrypting package... (Step 4 of 4)"
7. **Success:**
   - "Case exported successfully!"
   - "Location: [path]"
   - "Open Folder" button

### Import Flow
1. Detective clicks "Import Case" on Dashboard
2. **File Selection Dialog:**
   - Filter: `.pulse` files only
   - Select file
3. **Password Prompt:**
   - "Enter password to decrypt case"
   - Show filename
   - 3 attempts before lockout
4. **Decryption & Validation:**
   - "Decrypting package..."
   - "Validating manifest..."
   - Version compatibility check
5. **Conflict Check:**
   - If case number exists:
     - "Case [Number] already exists"
     - Option 1: "Rename to [Number]-TRANSFER"
     - Option 2: "Overwrite existing case" (⚠️ warning)
     - Option 3: "Cancel"
6. **Import Progress:**
   - "Creating case record... (Step 1 of 5)"
   - "Importing notes and identifiers... (Step 2 of 5)"
   - "Copying evidence files... (234 of 567 files - Step 3 of 5)"
   - "Verifying file integrity... (Step 4 of 5)"
   - "Finalizing import... (Step 5 of 5)"
7. **Error Handling (if partial failure):**
   - "Import encountered errors:"
   - List of what failed
   - Option 1: "Start Over" (rollback)
   - Option 2: "Proceed Anyway" (keep partial)
8. **Success:**
   - "Case imported successfully!"
   - "View Case" button (navigates to case)

## Security Features

1. **Password Encryption:**
   - AES-256 encryption
   - Password-based key derivation (PBKDF2)
   - Salt added to prevent rainbow tables

2. **File Integrity:**
   - SHA-256 checksums for all files
   - Verification on import
   - Detect tampering or corruption

3. **Sensitive Data Warning:**
   - Clear warnings on export
   - Remind about secure handling
   - Recommend encrypted USB drives

4. **No Backdoor:**
   - No master password
   - If password lost, data cannot be recovered
   - Appropriate for law enforcement use

## Technical Implementation

### Export Process
1. Query all case-related data from database
2. Calculate total file size
3. Show warnings if applicable
4. Create manifest.json
5. Copy files to temp directory with structure
6. Generate checksums
7. Create ZIP archive
8. Encrypt ZIP with password (AES-256)
9. Save to user-chosen location
10. Clean up temp files
11. Report success

### Import Process
1. Prompt for password
2. Decrypt ZIP to temp directory
3. Parse manifest.json
4. Validate PULSE version compatibility
5. Check case number conflicts
6. Begin transaction
7. Insert case record (get new ID)
8. Insert all related records (remap IDs)
9. Copy files to case directory
10. Verify checksums
11. Commit transaction
12. Clean up temp files
13. Navigate to imported case

### Error Recovery
- **Export failure:** Clean up temp files, show error
- **Import failure:** Rollback database changes, delete partial files, offer retry
- **Partial import:** Give user choice to keep or rollback

## File Size Considerations

### Typical Sizes
- Small case: 50MB - 500MB (PDFs, photos only)
- Medium case: 500MB - 5GB (some forensic evidence)
- Large case: 5GB - 50GB+ (full device images, warrant returns)

### Performance
- <1GB: Export in seconds
- 1-7GB: Export in 1-5 minutes
- >7GB: Warn user about time (5-20 minutes possible)

### Recommendations to User
- Use SSD for temp operations
- Use USB 3.0 or faster drives
- Avoid network drives for large exports
- Close other applications during large transfers

## IPC Channels

### Export
- `EXPORT_COMPLETE_CASE` - Main export handler
- `GET_EXPORT_SIZE` - Calculate size before export
- Parameters: `{ caseId, password }`
- Returns: `{ success, filePath, fileCount, totalSize }`

### Import
- `IMPORT_COMPLETE_CASE` - Main import handler
- `VALIDATE_IMPORT` - Check before importing
- Parameters: `{ filePath, password, options: { overwrite, rename } }`
- Returns: `{ success, caseId, warnings: [] }`

## UI Components

### Export Button (CaseDetail.tsx)
- Location: Header actions, after "Export DA Case"
- Icon: Package/box icon
- Label: "Export PULSE File"
- Tooltip: "Export complete case for transfer"

### Import Button (Dashboard.tsx)
- Location: Header, next to "Create New Case"
- Icon: Upload/import icon
- Label: "Import Case"
- Tooltip: "Import case from PULSE file"

### Dialogs
1. SecurityWarningDialog.tsx
2. PasswordSetupDialog.tsx
3. ExportProgressDialog.tsx
4. ImportPasswordDialog.tsx
5. ConflictResolutionDialog.tsx
6. ImportProgressDialog.tsx
7. PartialFailureDialog.tsx

## Testing Checklist

### Export Tests
- [ ] Small case (<100MB) exports successfully
- [ ] Large case (>5GB) shows warning
- [ ] Password requirement enforced
- [ ] Progress indicator updates correctly
- [ ] All files included in package
- [ ] Checksums generated correctly
- [ ] Package is encrypted
- [ ] Wrong password fails on import

### Import Tests
- [ ] Valid package imports successfully
- [ ] Password required
- [ ] Wrong password rejected (3 attempts)
- [ ] Case number conflict detected
- [ ] Rename option works
- [ ] Overwrite option works (with confirmation)
- [ ] All files copied correctly
- [ ] Checksums verified
- [ ] Partial failure handling works
- [ ] Imported case identical to original

### Edge Cases
- [ ] Export during active investigation
- [ ] Import to system with different PULSE version
- [ ] Corrupted ZIP file
- [ ] Missing files in package
- [ ] Disk full during export/import
- [ ] Permission errors
- [ ] Network drive issues

## Version Compatibility

### Same Version
- Full compatibility, no issues

### Minor Version Difference (1.0 vs 1.1)
- Show warning but allow import
- May have missing fields (use defaults)

### Major Version Difference (1.x vs 2.x)
- Show error, recommend matching versions
- Provide upgrade path if available

## Future Enhancements

1. **Batch Export:** Export multiple cases at once
2. **Compression Levels:** Let users choose speed vs size
3. **Cloud Integration:** Optional encrypted cloud sync (future only if requested)
4. **Export History:** Track what was exported when
5. **Import Audit:** Log all case imports for accountability

---

**Status:** Ready to implement
**Priority:** High (team continuity critical)
**Estimated Complexity:** High (encryption, large files, data integrity)
