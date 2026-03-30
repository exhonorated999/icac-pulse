# CyberTip PDF Parser Update

## Overview
Updated the NCMEC CyberTip PDF parser to correctly extract all fields based on the actual PDF structure.

## Changes Made

### 1. Updated `src/main/pdfParser.ts`

#### Enhanced Pattern Matching
- **CyberTipline Report Number**: Now matches "CyberTipline Report 136492947" format
- **Priority Level**: Extracts single-letter codes (I, E, R) and converts to full names:
  - `I` → Immediate
  - `E` → Elevated
  - `R` → Routine
- **Date Received**: Now matches "Received by NCMEC on 10-13-2022 17:47:36 UTC" format
- **Reporting Company**: Extracts from "Submitter:" field (e.g., "MediaLab/Kik")
- **Incident Type**: Extracts from "Incident Type:" field
- **Incident Time**: Extracts from "Incident Time:" field with full UTC timestamp

#### Improved Identifier Extraction
- **Email Address**: Specifically looks for "Email Address:" label in Suspect section
- **Screen/User Name**: Extracts from "Screen/User Name:" field
- **ESP User ID**: Extracts from "ESP User ID:" field
- **IP Addresses**: 
  - Extracts IP with event type and datetime (e.g., "45.49.103.125 (Login) - 09-24-2022 10:47:53 UTC")
  - Also captures all IPs found in the document
  - Validates IP addresses (ensures octets <= 255)
- **Phone Numbers**: Extracts US format phone numbers

#### File Information Extraction
- **Filename**: Extracts from "Filename:" labels
- **IP Address**: Associates IP addresses with uploaded files
- **Date/Time**: Extracts upload/event timestamps for files

### 2. Updated `src/renderer/pages/CyberTipForm.tsx`

#### Fixed Interface Definitions
- Updated `ParsedData` interface to match `NCMECParsedData` from parser:
  - Changed `reportDate` → `dateReceivedUtc`
  - Changed `dateReceivedUTC` → `dateReceivedUtc`
  - Added `incidentType` and `incidentTime`
  - Fixed `files` property to use `ipAddress` instead of `ip`

#### Added DateTime Conversion
- New `convertToDatetimeLocal()` helper function:
  - Converts NCMEC format: "10-10-2022 19:21:35 UTC"
  - To HTML datetime-local format: "2022-10-10T19:21"
  - Handles both Date Received and Incident Time fields

#### Enhanced Visual Display
- **Extracted Identifiers Section**: Shows all parsed identifiers with color-coded type badges
  - Email addresses
  - Usernames
  - User IDs
  - IP addresses (with event type and timestamp)
  - Phone numbers

- **Uploaded Files Section**: Displays file information with:
  - Filename with file icon
  - Associated IP address
  - Upload/event timestamp

## Fields Now Populated

### ✅ Successfully Extracted
1. **CyberTip Number** - From "CyberTipline Report [number]"
2. **Priority Level** - From "Priority Level: E" (converts to "Elevated", "Immediate", or "Routine")
3. **Date Received (UTC)** - From "Received by NCMEC on [date] [time] UTC"
4. **Reporting Company** - From "Submitter:" field
5. **Occurrence Date** - From "Incident Time:" field (populates Occurrence Date field)
6. **Identifiers** - Extracts and displays:
   - Email addresses
   - Screen/User names
   - ESP User IDs
   - IP addresses (with context)
   - Phone numbers
7. **Uploaded Files** - Shows filenames with associated IPs and timestamps

### 📋 Display Sections
- Success message when PDF is parsed
- Identifiers section with color-coded badges
- Files section with detailed information

## Testing Instructions

### 1. Rebuild the Application
```bash
npm run build
npm run dev
```

### 2. Test the CyberTip Ingestion
1. Navigate to Create Case → CyberTip
2. Click "Click to upload NCMEC PDF"
3. Select your test NCMEC PDF
4. Verify the following are populated:
   - ✅ CyberTip Number field
   - ✅ Priority Level dropdown
   - ✅ Date Received (UTC) field
   - ✅ Reporting Company field
   - ✅ Occurrence Date field (from Incident Time)
   - ✅ Extracted Identifiers section appears
   - ✅ Uploaded Files section appears

### 3. Verify Extracted Data
Check that the displayed information matches the PDF:
- **Identifiers section** should show:
  - Email: js7017987@gmail.com
  - Username: coomgoomer
  - User ID: coomgoomer_gld
  - IP addresses with login/upload events
  
- **Files section** should show:
  - All uploaded filenames from the PDF
  - Associated IP addresses
  - Upload timestamps

## Known Limitations

1. **Report Date**: Currently not extracted because NCMEC PDFs show "Received by NCMEC" date but not a separate "Report Date". You may need to clarify if this should be the same as Date Received or a different field.

2. **PDF Structure Variations**: The parser is optimized for the standard NCMEC PDF format shown in your example. If NCMEC changes their PDF format, the parser may need updates.

3. **Complex Tables**: File information extraction works best when the PDF has clear "Filename:" labels. More complex table structures may require additional parsing logic.

## Future Enhancements

Consider adding:
1. MD5 hash extraction for uploaded files
2. Geo-location data extraction from the Geo-Lookup tables
3. Additional metadata like "Did Reporting ESP view entire contents"
4. Chat log extraction if present in PDF
5. More robust error handling for malformed PDFs

## Troubleshooting

### If fields are not populating:
1. Check browser console (F12) for parsing errors
2. Verify the PDF format matches the expected structure
3. Try manually entering one field to see if the form works
4. Check that the PDF text is extractable (not scanned images)

### If identifiers aren't showing:
1. Verify the PDF contains the expected sections (Suspect, Source Information)
2. Check that field labels match exactly (e.g., "Email Address:", "Screen/User Name:")
3. Review console output for the parsed data structure

## Support

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify your PDF matches the NCMEC standard format
3. Test with the sample PDF structure provided in the images
