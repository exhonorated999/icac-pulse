# Warrant Management System - Complete

## Features Implemented

### 1. Add/Edit Warrants
- **Company Name** - Who the warrant is served to (Facebook, Google, etc.)
- **Date Issued** - When the warrant was signed by the judge
- **Date Served** - When it was actually served to the company (optional)
- **Production Due Date** - When the company must respond
- **Notes** - Additional information about the warrant

### 2. Warrant Status Tracking
- **Pending** - Warrant issued but response not received (cyan badge)
- **Overdue** - Past due date and not received (animated pink badge with days overdue)
- **Received** - Response received (green checkmark badge)

### 3. File Management

#### Upload Warrant PDF
- Upload the signed warrant document
- Automatically named: `CompanyName_DateIssued_warrant.pdf`
- Stored in: `cases/{caseNumber}/warrants/`
- Can view PDF from case detail page

#### Attach Warrant Returns
- **Upload entire folders** or individual files
- Select multiple files/folders at once
- Organized in: `cases/{caseNumber}/warrants/CompanyName_DateIssued_return/`
- One-click to open return folder in Windows Explorer

### 4. Quick Actions

#### Mark as Received Button
- One click to mark warrant return as received
- Automatically records the date received
- Changes status badge to green "Received"
- Removes from overdue list

#### Edit Warrant
- Pencil icon to edit any warrant details
- Update dates, company name, notes
- Same form as adding new warrant

#### Delete Warrant
- Trash icon with confirmation dialog
- Permanently removes warrant record

### 5. Visual Indicators

**Overdue Warrants:**
- Bright pink border
- Pink background tint
- Animated pulsing "X days overdue" badge
- Clearly visible to grab officer's attention

**Received Warrants:**
- Green status badge
- Success border color
- Shows date received

**Pending Warrants:**
- Cyan status badge
- Standard border

### 6. Dashboard Integration (Already Built)

The Dashboard already shows:
- Count of pending warrants
- **Overdue warrant alerts** with:
  - Company name
  - Case number
  - Due date
  - Days overdue in pink badge
- Click-through to case (coming soon)

## How to Use

### Add a New Warrant

1. Open a case
2. Click the **Warrants** tab
3. Click **Add Warrant** button
4. Fill in:
   - Company Name (required)
   - Date Issued (required)
   - Date Served (optional - when you actually served it)
   - Production Due Date (required - typically 30 days from service)
   - Notes (optional)
5. Click **Add Warrant**

### Upload Warrant PDF

1. Click **Upload Warrant PDF** button on the warrant card
2. Select the signed warrant PDF file
3. PDF is automatically copied to case directory
4. Click **View PDF** to open in Windows Explorer

### Serve the Warrant

1. Once you serve the warrant, click **Edit** (pencil icon)
2. Update the **Date Served** field
3. This helps track when the 30-day clock started

### Track Production Due Date

The system automatically:
- Shows days until due (if pending)
- Shows days overdue (in bright pink if past due)
- Alerts on dashboard if overdue

### When You Receive Returns

**Option 1: Mark as Received (Quick)**
1. Click **Mark as Received** button
2. Status instantly changes to "Received"
3. Removed from overdue alerts

**Option 2: Attach Files First**
1. Click **Attach Returns** button
2. Select warrant return files/folders
3. Files are organized in case directory
4. Then click **Mark as Received**

### View Warrant Returns

1. After uploading, click **View Returns** button
2. Opens the return folder in Windows Explorer
3. All files organized by company and date

## File Organization

```
cases/
└── {caseNumber}/
    └── warrants/
        ├── Facebook_2024-01-15_warrant.pdf
        ├── Facebook_2024-01-15_return/
        │   ├── user_data.xlsx
        │   ├── messages.pdf
        │   └── metadata.json
        ├── Google_2024-02-01_warrant.pdf
        └── Google_2024-02-01_return/
            └── search_records/
                ├── file1.pdf
                └── file2.pdf
```

## Dashboard Overdue Alerts

Officers see overdue warrants immediately on dashboard:
- Bright pink alert box
- List of all overdue warrants
- Company name, case number, due date
- Days overdue in pink badge
- Can't miss it!

## Best Practices

1. **Set Due Date 30 Days from Service** - Most warrants give companies 30 days
2. **Upload Warrant PDF Immediately** - Keep everything organized
3. **Update Date Served** - Tracks when the clock started
4. **Mark Received Promptly** - Keeps dashboard clean
5. **Attach Returns Right Away** - Don't lose track of files
6. **Add Notes** - Anything special about this warrant (follow-ups, partial returns, etc.)

## Testing Checklist

- [ ] Create a warrant with all fields
- [ ] Upload a warrant PDF (any PDF for testing)
- [ ] Click "View PDF" button - should open file in Windows Explorer
- [ ] Edit warrant details (change dates, notes)
- [ ] Mark warrant as received
- [ ] Attach warrant return files (select multiple files)
- [ ] Attach warrant return folder (select a folder)
- [ ] Click "View Returns" button - should open returns folder
- [ ] Delete a warrant (with confirmation)
- [ ] Check dashboard shows overdue warrants
- [ ] Verify file organization in Windows Explorer:
  - Navigate to: `C:\Users\[YourName]\AppData\Roaming\ICAC_CaseManager\cases\[YourCaseNumber]\warrants\`
  - Should see: `CompanyName_Date_warrant.pdf`
  - Should see folder: `CompanyName_Date_return\` with uploaded files inside

## File Organization Structure

After uploading warrant files, the structure should look like:

```
C:\Users\[YourName]\AppData\Roaming\ICAC_CaseManager\
└── cases\
    └── 2024-TEST-001\
        └── warrants\
            ├── Facebook_2024-11-25_warrant.pdf
            ├── Facebook_2024-11-25_return\
            │   ├── user_data.xlsx
            │   ├── messages.pdf
            │   └── account_info\
            │       ├── profile.json
            │       └── metadata.txt
            ├── Google_2024-11-26_warrant.pdf
            └── Google_2024-11-26_return\
                └── search_history.csv
```

## How the File Upload Works

### Warrant PDF Upload:
1. Click "Upload Warrant PDF"
2. Select a PDF file
3. File is copied to: `cases/[CaseNumber]/warrants/CompanyName_Date_warrant.pdf`
4. Path stored in database: `warrants/CompanyName_Date_warrant.pdf`
5. "View PDF" button opens this location in Windows Explorer

### Warrant Return Upload:
1. Click "Attach Returns"
2. Select files OR folders (can select multiple)
3. Files/folders copied to: `cases/[CaseNumber]/warrants/CompanyName_Date_return/`
4. Path stored in database: `warrants/CompanyName_Date_return`
5. "View Returns" button opens this folder in Windows Explorer

### Smart File Handling:
- **Single file selected** → Copies file to return folder
- **Multiple files selected** → Copies all files to return folder
- **Folder selected** → Copies entire folder and its contents to return folder
- **Mixed (files + folders)** → Copies everything to return folder

## Next Steps

After testing warrants, we can add:
- Suspect information section
- Operations plan upload
- Case report writing
- Prosecution tracking
- P2P case form
- Chat case form
- Other case type form
