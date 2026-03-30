# CyberTip PDF Parser - Pattern Reference

This document shows the exact patterns the parser looks for in NCMEC PDFs.

## Basic Information Patterns

### CyberTip Report Number
**Pattern**: `CyberTipline Report 136492947`
**Regex**: `/CyberTipline\s+Report\s+#?:?\s*(\d+)/i`
**Extracts**: `136492947`

### Priority Level
**Pattern**: `Priority Level: E`
**Regex**: `/Priority\s+Level:\s*([A-Z])/i`
**Mapping**:
- `I` → Immediate
- `E` → Elevated
- `R` → Routine

### Date Received
**Pattern**: `Received by NCMEC on 10-13-2022 17:47:36 UTC`
**Regex**: `/Received\s+by\s+NCMEC\s+on\s+([\d\-]+\s+[\d:]+\s+UTC)/i`
**Extracts**: `10-13-2022 17:47:36 UTC`
**Converts to**: `2022-10-13T17:47` (for HTML datetime-local input)

### Reporting Company
**Pattern**: 
```
Submitter:
MediaLab/Kik
```
**Regex**: `/Submitter:?\s*\n?\s*([^\n]+?)(?:\n|Business\s+Address)/i`
**Extracts**: `MediaLab/Kik`

### Incident Type
**Pattern**: `Incident Type: Child Pornography (possession, manufacture, and distribution)`
**Regex**: `/Incident\s+Type:\s*([^\n]+)/i`
**Extracts**: `Child Pornography (possession, manufacture, and distribution)`

### Incident Time
**Pattern**: `Incident Time: 10-10-2022 19:21:35 UTC`
**Regex**: `/Incident\s+Time:\s*([\d\-]+\s+[\d:]+\s+UTC)/i`
**Extracts**: `10-10-2022 19:21:35 UTC`
**Converts to**: `2022-10-10T19:21` (for Occurrence Date field)

## Identifier Patterns

### Email Address
**Pattern**: `Email Address: js7017987@gmail.com`
**Regex**: `/Email\s+Address:\s*([^\n]+)/i`
**Also uses**: `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g` (fallback for all emails)
**Type**: `email`

### Screen/User Name
**Pattern**: `Screen/User Name: coomgoomer`
**Regex**: `/Screen\/User\s+Name:\s*([^\n]+)/i`
**Type**: `username`

### ESP User ID
**Pattern**: `ESP User ID: coomgoomer_gld`
**Regex**: `/ESP\s+User\s+ID:\s*([^\n]+)/i`
**Type**: `userid`

### IP Address (with context)
**Pattern**: 
```
IP Address: 45.49.103.125 (Login)
09-24-2022 10:47:53 UTC
```
**Regex**: `/IP\s+Address:\s*([\d.]+)\s*\(([^)]+)\)\s*([\d\-]+\s+[\d:]+\s+UTC)/i`
**Extracts**: `45.49.103.125 (Login) - 09-24-2022 10:47:53 UTC`
**Type**: `ip`

### IP Address (general)
**Regex**: `/\b(?:\d{1,3}\.){3}\d{1,3}\b/g`
**Validation**: Each octet must be ≤ 255
**Type**: `ip`

### Phone Numbers
**Regex**: `/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g`
**Type**: `phone`
**Examples**: `555-123-4567`, `555.123.4567`, `5551234567`

## File Information Patterns

### Filename
**Pattern**: `Filename: 37b083ae-6cc9-40ea-8cea-bcc008c6b905.jpg`
**Regex**: `/Filename:\s*([^\n]+)/gi`
**Extracts**: `37b083ae-6cc9-40ea-8cea-bcc008c6b905.jpg`

### Associated IP and DateTime
**Pattern** (in Source Information table):
```
Type        Value           Event   Date/Time
IP Address  45.49.103.125   Upload  09-24-2022 10:50:52 UTC
```
**Regex**: `/IP\s+Address\s+([\d.]+)\s+(\w+)\s+([\d\-]+\s+[\d:]+\s+UTC)/i`
**Context**: Looks within 500 characters after each filename
**Extracts**:
- IP: `45.49.103.125`
- Event: `Upload`
- DateTime: `09-24-2022 10:50:52 UTC`

## Date Format Conversion

The parser includes a helper function to convert NCMEC date format to HTML datetime-local format:

**Input Format**: `MM-DD-YYYY HH:MM:SS UTC`
**Example**: `10-10-2022 19:21:35 UTC`

**Output Format**: `YYYY-MM-DDTHH:MM`
**Example**: `2022-10-10T19:21`

**Conversion Logic**:
1. Parse with regex: `/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/`
2. Extract: month, day, year, hour, minute, second
3. Reformat: `${year}-${month}-${day}T${hour}:${minute}`

## Examples from Your PDF

Based on the PDF images you provided:

### Page 1 (Cover)
```
CyberTipline Report 136492947
Priority Level: E
Received by NCMEC on 10-13-2022 17:47:36 UTC
```
**Extracted**:
- `cybertipNumber`: "136492947"
- `priorityLevel`: "Elevated"
- `dateReceivedUtc`: "10-13-2022 17:47:36 UTC"

### Page 3 (Section A - Suspect)
```
Submitter:
MediaLab/Kik

Incident Type: Child Pornography (possession, manufacture, and distribution)
Incident Time: 10-10-2022 19:21:35 UTC

Email Address: js7017987@gmail.com
Screen/User Name: coomgoomer
ESP User ID: coomgoomer_gld
IP Address: 45.49.103.125 (Login)
09-24-2022 10:47:53 UTC
```
**Extracted**:
- `reportingCompany`: "MediaLab/Kik"
- `incidentType`: "Child Pornography (possession, manufacture, and distribution)"
- `incidentTime`: "10-10-2022 19:21:35 UTC"
- Identifiers:
  - email: "js7017987@gmail.com"
  - username: "coomgoomer"
  - userid: "coomgoomer_gld"
  - ip: "45.49.103.125 (Login) - 09-24-2022 10:47:53 UTC"

### Page 4 (Uploaded Files)
```
Filename: 37b083ae-6cc9-40ea-8cea-bcc008c6b905.jpg

Source Information:
Type        Value           Event   Date/Time
IP Address  45.49.103.125   Upload  09-24-2022 10:50:52 UTC
```
**Extracted File**:
- `filename`: "37b083ae-6cc9-40ea-8cea-bcc008c6b905.jpg"
- `ipAddress`: "45.49.103.125"
- `datetime`: "09-24-2022 10:50:52 UTC"

## Testing Your Parser

To test if a specific pattern is working:

1. Open Developer Tools (F12) in the app
2. Upload your PDF
3. Check the console for the parsed data object
4. Compare what was extracted vs. what you expected

Example console output:
```javascript
{
  cybertipNumber: "136492947",
  priorityLevel: "Elevated",
  dateReceivedUtc: "10-13-2022 17:47:36 UTC",
  reportingCompany: "MediaLab/Kik",
  incidentType: "Child Pornography (possession, manufacture, and distribution)",
  incidentTime: "10-10-2022 19:21:35 UTC",
  identifiers: [
    { type: "email", value: "js7017987@gmail.com" },
    { type: "username", value: "coomgoomer" },
    { type: "userid", value: "coomgoomer_gld" },
    { type: "ip", value: "45.49.103.125 (Login) - 09-24-2022 10:47:53 UTC" },
    { type: "ip", value: "45.49.103.125" }
  ],
  files: [
    {
      filename: "37b083ae-6cc9-40ea-8cea-bcc008c6b905.jpg",
      ipAddress: "45.49.103.125",
      datetime: "09-24-2022 10:50:52 UTC"
    }
  ]
}
```

## Customizing Patterns

If you need to adjust patterns for your specific PDF format:

1. **Edit**: `src/main/pdfParser.ts`
2. **Find** the relevant regex pattern
3. **Update** to match your PDF format
4. **Test** with a sample PDF
5. **Rebuild**: `npm run build`

## Case Sensitivity

All regex patterns use the `i` flag (case-insensitive) except for:
- IP address validation
- Email address extraction
- General text extraction

This ensures the parser works even if NCMEC changes capitalization in their PDFs.

## Whitespace Handling

Patterns are designed to handle:
- Multiple spaces: `\s+` matches one or more spaces
- Line breaks: `\n` explicitly handled where needed
- Tabs and other whitespace: Handled by `\s`

## Error Handling

The parser is designed to be fault-tolerant:
- If a pattern isn't found, the field is simply left empty
- No errors are thrown for missing fields
- The form can still be submitted with partial data
- Manual entry is always available as fallback

## Future Enhancements

Patterns that could be added:
- MD5 hashes: `/MD5:\s*([a-f0-9]{32})/i`
- Physical addresses: More complex pattern needed
- Geo-location data: From Geo-Lookup tables
- Additional metadata fields
- Multiple suspect information
- Chat log extraction
