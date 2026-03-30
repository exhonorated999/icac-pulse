# Testing CyberTip PDF Parser

## Summary of Changes

Updated the CyberTip PDF parser to correctly extract all fields from NCMEC PDFs based on the actual PDF format you provided.

### Files Modified:
1. `src/main/pdfParser.ts` - Enhanced pattern matching for all fields
2. `src/renderer/pages/CyberTipForm.tsx` - Updated form to display parsed data correctly

## Testing Steps

### 1. Rebuild the Application

Open a terminal in `H:\Workspace\icac_case_manager` and run:

```bash
npm run build
```

Then start the development server:

```bash
npm run dev
```

### 2. Test CyberTip Ingestion

1. In the application, go to **Create Case** → **CyberTip**
2. Click **"Click to upload NCMEC PDF"**
3. Select your test NCMEC PDF file

### 3. Verify Extracted Fields

After uploading, check that the following fields are populated:

#### ✅ Basic Information
- **CyberTip Number**: Should show `136492947`
- **Priority Level**: Should show `Elevated` (converted from "E")
- **Date Received (UTC)**: Should show `2022-10-13T17:47`
- **Reporting Company**: Should show `MediaLab/Kik`
- **Occurrence Date**: Should show `2022-10-10T19:21` (from Incident Time)

#### ✅ Extracted Identifiers Section
Should display a card with all found identifiers:
- **EMAIL**: js7017987@gmail.com
- **USERNAME**: coomgoomer
- **USERID**: coomgoomer_gld
- **IP**: 45.49.103.125 (Login) - 09-24-2022 10:47:53 UTC
- **IP**: 45.49.103.125 (and other IPs found in the document)

#### ✅ Uploaded Files Section
Should display cards for each file found:
- **Filename**: 37b083ae-6cc9-40ea-8cea-bcc008c6b905.jpg
  - IP: 45.49.103.125
  - Time: 09-24-2022 10:50:52 UTC
- **Filename**: Subscriber-data-coomgoomer_gld.pdf
  - (and other files from the PDF)

### 4. Visual Verification

The parsed data should be displayed in two color-coded sections:

1. **Extracted Identifiers** - Blue-themed section with:
   - Type badges (EMAIL, USERNAME, IP, etc.)
   - Values in monospace font
   - Clean, organized layout

2. **Uploaded Files** - Blue-themed section with:
   - File icon for each file
   - Filename in monospace font
   - Associated IP address and timestamp (if available)

### 5. Form Population

Verify that the form fields themselves are auto-filled:
- CyberTip Number field has the correct number
- Priority Level dropdown is set to the correct level
- Date fields are populated with the correct dates
- Reporting Company field is filled

## Expected Behavior

### ✅ Success Case
- Green success message: "✓ PDF parsed successfully - form fields auto-filled"
- All identifiers displayed in organized cards
- All uploaded files listed with metadata
- Form fields populated correctly
- Can still manually edit any field if needed

### ❌ If Parsing Fails
- Alert: "Failed to upload or parse PDF. You can manually enter the information."
- Can still manually enter all information
- Check browser console (F12) for error details

## Troubleshooting

### If fields are NOT populating:

1. **Check Console Logs**
   - Press F12 to open Developer Tools
   - Go to Console tab
   - Look for errors or warnings related to PDF parsing
   - Look for the parsed data object to see what was extracted

2. **Verify PDF Text is Extractable**
   - Some PDFs are scanned images and don't have extractable text
   - Try opening the PDF in a text editor - if you see readable text, it should work
   - If the PDF is just images, the parser won't work

3. **Check PDF Format**
   - The parser is designed for the standard NCMEC PDF format
   - If NCMEC has changed their format, the patterns may need updating
   - Compare your PDF to the screenshots provided

4. **File Path Issues**
   - Make sure the file path doesn't contain special characters
   - Try moving the PDF to a simple path like `C:\temp\test.pdf`

### Common Issues:

**Issue**: Only CyberTip Number and Priority Level populate
- **Cause**: Old parser code is still running
- **Fix**: Make sure to run `npm run build` before `npm run dev`

**Issue**: Identifiers section doesn't appear
- **Cause**: No identifiers were extracted from the PDF
- **Fix**: Check that the PDF has sections labeled "Email Address:", "Screen/User Name:", etc.

**Issue**: Date/time fields are empty
- **Cause**: Date format doesn't match expected pattern
- **Fix**: Check console for the parsed date strings and verify format

## Next Steps After Testing

Once you confirm everything works:

1. Test with multiple different NCMEC PDFs to ensure consistency
2. Take note of any fields that consistently don't parse correctly
3. If you find issues, check the console output to see what was extracted
4. Report back any problems with specific examples

## Additional Notes

- The parser is designed to be forgiving - it will extract what it can find
- If a field isn't found, it won't throw an error, it just won't populate that field
- You can always manually enter or correct any fields after parsing
- The parsed data is only used to pre-fill the form - you're not locked into it

## File Structure Reference

```
src/
├── main/
│   ├── pdfParser.ts         ← Core parsing logic
│   └── index.ts             ← IPC handler registration
└── renderer/
    └── pages/
        └── CyberTipForm.tsx ← Form UI and data display
```

## Support

If you encounter issues:
1. Check CYBERTIP_PARSER_UPDATE.md for detailed technical information
2. Review console logs for specific error messages
3. Verify the PDF format matches expectations
4. Test with the sample PDF structure from the screenshots
