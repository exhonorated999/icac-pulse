# Outreach Materials & Resources Features

## Overview
Added two new features to help officers manage training materials, documents, and software:

1. **Outreach Materials** - Manage materials used in public outreach events
2. **Resources Library** - Centralized repository for all training materials and software

## Feature 1: Outreach Materials

### Purpose
Store and organize PowerPoint presentations, PDFs, videos, worksheets, and other materials used for public outreach events.

### Location
Accessible from the Public Outreach page

### Database Schema
```sql
CREATE TABLE outreach_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_name TEXT NOT NULL,
  material_type TEXT NOT NULL,          -- Powerpoint, PDF, Video, Worksheet, etc.
  file_path TEXT NOT NULL,              -- Relative path: outreach/filename.ext
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Storage
- **Backend Folder**: `{CasesPath}/outreach/`
- Files are stored with their original names
- Indexed by material type for easy filtering

### Features
- **Add Material**: Upload file with name, type, and notes
- **View Material**: Click to open file location in File Explorer
- **Edit Material**: Update name, type, and notes (file cannot be changed)
- **Delete Material**: Removes both database entry and physical file
- **Material Types**: Powerpoint, PDF, Video, Worksheet, etc.

### Display Fields
- Material Name
- Material Type
- Notes (optional)
- Created Date
- Actions: Open, Edit, Delete

---

## Feature 2: Resources Library

### Purpose
Centralized repository for all training materials, documentation, and software that officers use in their work. Unlike outreach materials which are specific to public events, resources are general-purpose materials.

### Location
New menu item in sidebar: **Resources**

### Database Schema
```sql
CREATE TABLE resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  resource_type TEXT,                    -- PDF, Powerpoint, Video, Software, etc. (optional)
  file_path TEXT NOT NULL,               -- Relative path: resources/filename.ext
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Storage
- **Backend Folder**: `{CasesPath}/resources/`
- Files stored with original names
- Auto-timestamps creation date
- Indexed by resource type

### Features
- **Add Resource Button**: Prominent button at top of page
- **Auto Date Stamp**: System automatically records creation date
- **File Upload**: Any file type (PDFs, PowerPoints, Videos, Software installers, etc.)
- **Optional Fields**: Type and Notes are optional for quick additions
- **Grid Display**: Resources shown in card-based grid
- **File Icons**: Automatic icons based on file type (PDF, PPT, Video, Software, etc.)
- **Actions**: Open (opens file location), Edit (update metadata), Delete (removes file and entry)

### Display Fields
- Title (required)
- Resource Type (optional)
- File Icon (auto-detected from extension)
- Notes (optional)
- Created Date (auto-stamped)
- Actions: Open, Edit, Delete

---

## Technical Implementation

### Files Modified/Created

#### Backend
1. **src/main/database.ts**
   - Added `outreach_materials` table
   - Added `resources` table
   - Added indexes for type fields

2. **src/main/index.ts**
   - Added outreach materials IPC handlers:
     - `GET_OUTREACH_MATERIALS`
     - `ADD_OUTREACH_MATERIAL`
     - `UPDATE_OUTREACH_MATERIAL`
     - `DELETE_OUTREACH_MATERIAL`
   - Added resources IPC handlers:
     - `GET_ALL_RESOURCES`
     - `GET_RESOURCE`
     - `ADD_RESOURCE`
     - `UPDATE_RESOURCE`
     - `DELETE_RESOURCE`

3. **src/shared/types.ts**
   - Added IPC channel constants for both features

4. **src/preload/index.ts**
   - Exposed all new IPC methods to renderer process

#### Frontend
1. **src/renderer/pages/Resources.tsx** (NEW FILE)
   - Complete Resources Library page
   - Add/Edit/Delete dialogs
   - Grid-based card display
   - File type icons
   - Upload functionality

2. **src/renderer/App.tsx**
   - Added Resources route
   - Added Resources import

3. **src/renderer/components/Layout.tsx**
   - Added Resources to sidebar menu
   - Created ResourcesIcon component with teal glow
   - Added icon rendering logic

### File Organization

```
{CasesPath}/
├── outreach/
│   ├── internet_safety_presentation.pptx
│   ├── social_media_dangers.pdf
│   └── cyberbullying_video.mp4
│
├── resources/
│   ├── ncmec_training_2024.pdf
│   ├── forensics_tools_v2.exe
│   ├── case_law_reference.pdf
│   └── interview_techniques.pptx
│
└── {Case Numbers}/
    ├── 24-001/
    ├── 24-002/
    └── ...
```

---

## User Workflows

### Adding Outreach Material
1. Navigate to Public Outreach page
2. Materials section visible below events list
3. Click "Add Material"
4. Enter material name
5. Select type from dropdown
6. Choose file to upload
7. Add notes (optional)
8. Click "Add Material"
9. File uploaded to `outreach/` folder
10. Entry appears in materials list

### Adding Resource
1. Click "Resources" in sidebar
2. Click "Add Resource" button (top right)
3. Enter title
4. Select type (optional)
5. Choose file to upload
6. Add notes (optional)
7. Click "Add Resource"
8. File uploaded to `resources/` folder
9. Card appears in grid with auto-detected icon

### Opening Files
- Click "Open" button on any material/resource
- Opens File Explorer with file selected
- User can then open, copy, or move file as needed

---

## Benefits

### For Units
- **Centralized Storage**: All materials in one place
- **Easy Access**: No more searching through folders or email
- **Version Control**: Update materials without losing references
- **Quick Sharing**: Easy to find and share materials with colleagues
- **Organization**: Type-based categorization

### For Officers
- **Time Saving**: Find materials instantly
- **Professionalism**: Always have latest versions ready
- **Consistency**: Everyone uses same approved materials
- **Flexibility**: Add any file type (software, videos, documents)

---

## Future Enhancements

Potential improvements:

1. **Tagging System**: Add tags to materials/resources for better filtering
2. **Search Functionality**: Search by title, type, or notes
3. **Categories**: Additional categorization beyond type
4. **Version History**: Track multiple versions of same material
5. **Usage Tracking**: Track which materials are used most frequently
6. **Share to Event**: Link materials directly to outreach events
7. **Bulk Upload**: Upload multiple files at once
8. **File Preview**: Preview PDFs and images without opening
9. **Export List**: Export list of all materials to PDF/CSV
10. **Access Permissions**: Control who can add/delete materials

---

## Notes

- Files are stored with original filenames for easy identification
- Physical files are deleted when database entries are removed
- Both features use same file upload system as case evidence
- Progress indicators shown for large file uploads
- Materials and Resources are separate to keep outreach-specific content distinct from general resources

---

## Build Instructions

After implementing these changes, rebuild:

```bash
cd H:\Workspace\icac_case_manager
npm run build
npm run dist
```

The new installer will include:
- Resources page in sidebar
- Outreach Materials section (to be added to OutreachList page)
- All backend database tables and handlers
