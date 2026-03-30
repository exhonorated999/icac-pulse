# ICAC Case Manager - Implementation Plan

## Executive Summary
Standalone Windows desktop application for managing Internet Crimes Against Children cases with strict offline-only operation, hardware-bound licensing, and comprehensive case management across 4 case types.

## System Architecture

### Technology Stack
- **Frontend:** React 18 + TypeScript + Tailwind CSS
- **Desktop Framework:** Electron
- **Database:** SQLite with better-sqlite3 (encrypted, hardware-bound)
- **PDF Processing:** pdf-parse (NCMEC extraction)
- **Rich Text:** React-Quill
- **PDF Generation:** jsPDF
- **Build:** electron-builder → standalone .exe

### Color Scheme (Neon Midnight)
```
Background: #0B1120
Secondary panels: #121A2C
Main text: #E0E0FF
Muted text: #94A3C0
Primary accent: #00D4FF (cyan)
Secondary accent: #FF2A6D (hot pink)
Success: #39FFA0
Warning: #FFB800
```

### Data Storage Architecture
```
AppData/ICAC_CaseManager/
├── database.db (SQLite - encrypted with hardware ID)
├── cases/
│   ├── {caseNumber}/
│   │   ├── cybertip/
│   │   │   ├── ncmec_report.pdf
│   │   │   └── evidence_files/
│   │   ├── warrants/
│   │   │   ├── {companyName}_{date}/
│   │   │   │   ├── signed_warrant.pdf
│   │   │   │   └── returns/
│   │   ├── operations_plan/
│   │   │   └── ops_plan.pdf
│   │   ├── suspect/
│   │   │   └── photo.jpg
│   │   └── reports/
│   │       └── case_report.pdf
```

## Database Schema

### users
- id (PRIMARY KEY)
- username (UNIQUE)
- hardware_id (encrypted hash of mobo serial + CPU ID)
- created_at
- last_login

### cases
- id (PRIMARY KEY)
- case_number (UNIQUE)
- case_type (ENUM: cybertip, p2p, chat, other)
- status (ENUM: open, waiting_warrants, ready_residential, arrest, closed_no_arrest, referred)
- created_at
- updated_at
- user_id (FOREIGN KEY)

### cybertip_data (extends cases)
- case_id (FOREIGN KEY)
- cybertip_number
- report_date
- occurrence_date
- reporting_company
- priority_level
- date_received_utc
- ncmec_folder_path

### cybertip_identifiers
- id (PRIMARY KEY)
- case_id (FOREIGN KEY)
- identifier_type (email, username, ip, phone, userid, name)
- identifier_value

### cybertip_files
- id (PRIMARY KEY)
- case_id (FOREIGN KEY)
- filename
- ip_address
- datetime
- officer_description

### p2p_data (extends cases)
- case_id (FOREIGN KEY)
- download_date
- platform (shareazza, bittorrent, freenet, other)
- suspect_ip
- ip_provider
- download_folder_path

### chat_data (extends cases)
- case_id (FOREIGN KEY)
- initial_contact_date
- platform
- identifiers (JSON array)

### other_data (extends cases)
- case_id (FOREIGN KEY)
- case_type_description

### suspects
- id (PRIMARY KEY)
- case_id (FOREIGN KEY)
- name
- dob
- drivers_license
- photo_path
- address
- height
- weight
- phone
- workplace
- has_weapons (BOOLEAN)

### weapons
- id (PRIMARY KEY)
- suspect_id (FOREIGN KEY)
- weapon_description

### warrants
- id (PRIMARY KEY)
- case_id (FOREIGN KEY)
- company_name
- date_issued
- date_due
- received (BOOLEAN)
- date_received
- signed_warrant_path
- warrant_return_path

### operations_plans
- id (PRIMARY KEY)
- case_id (FOREIGN KEY)
- plan_pdf_path
- approved (BOOLEAN)
- approver_name
- approval_date
- execution_date

### case_reports
- id (PRIMARY KEY)
- case_id (FOREIGN KEY)
- content (HTML from Quill)
- updated_at

### prosecution_info
- id (PRIMARY KEY)
- case_id (FOREIGN KEY)
- charges (JSON array)
- court_case_number
- assigned_court
- da_name
- da_contact

### probable_cause
- id (PRIMARY KEY)
- case_id (FOREIGN KEY)
- content (TEXT - living document)
- updated_at

### todos
- id (PRIMARY KEY)
- case_id (FOREIGN KEY, nullable for dashboard todos)
- content
- completed (BOOLEAN)
- created_at
- completed_at

## Implementation Phases

### Phase 1: Project Setup & Infrastructure
- [P1-1] Initialize Electron + React + TypeScript project
- [P1-2] Configure Tailwind with neon theme
- [P1-3] Set up SQLite with better-sqlite3
- [P1-4] Implement hardware-bound encryption
- [P1-5] Create user registration on first launch
- [P1-6] Set up file system structure in AppData

### Phase 2: Database & Core Services
- [P2-1] Create database schema and migrations
- [P2-2] Build database service layer (CRUD operations)
- [P2-3] Implement file management service (upload, organize, retrieve)
- [P2-4] Create PDF parsing service for NCMEC CyberTips

### Phase 3: UI Foundation & Navigation
- [P3-1] Build main layout with sidebar navigation
- [P3-2] Create dashboard with stats cards
- [P3-3] Implement overdue warrant alerts component
- [P3-4] Build todo list component (dashboard + case-level)
- [P3-5] Create case list view with filters

### Phase 4: Case Creation Workflows
- [P4-1] Build case type selection screen
- [P4-2] Implement CyberTip intake form with PDF upload/parse
- [P4-3] Implement P2P intake form
- [P4-4] Implement Chat intake form
- [P4-5] Implement Other intake form

### Phase 5: Shared Case Components
- [P5-1] Build Warrant section (list, upload, status tracking)
- [P5-2] Build Suspect Information form with photo upload
- [P5-3] Build Operations Plan section with approval workflow
- [P5-4] Build Report Summary rich text editor (React-Quill)
- [P5-5] Build Prosecution Info form
- [P5-6] Build Probable Cause editor

### Phase 6: Case Type-Specific Views
- [P6-1] Create CyberTip case detail view (NCMEC info display)
- [P6-2] Create P2P case detail view
- [P6-3] Create Chat case detail view
- [P6-4] Create Other case detail view

### Phase 7: Export Functionality
- [P7-1] Build case PDF summary generator
- [P7-2] Build dashboard stats PDF report
- [P7-3] Implement full case export (folder structure + files)
- [P7-4] Build report summary PDF export

### Phase 8: Packaging & Distribution
- [P8-1] Configure electron-builder for Windows .exe
- [P8-2] Set up auto-updater (disabled - no cloud)
- [P8-3] Create installer with proper permissions
- [P8-4] Test on clean Windows machine
- [P8-5] Create user documentation

## Key Features Detail

### Hardware-Bound Registration
1. On first launch, prompt for username
2. Generate hardware ID: `hash(motherboard_serial + cpu_id + MAC)`
3. Encrypt database with hardware-derived key
4. Store in SQLite, subsequent launches verify match
5. If hardware mismatch detected → app refuses to launch

### NCMEC PDF Auto-Parse
1. Officer uploads NCMEC PDF
2. Extract text via pdf-parse
3. Regex patterns match:
   - `CyberTipline Report #: (\d+)`
   - `Priority Level: (.*)`
   - `Date Received.*: (.*UTC)`
   - Identifiers section → extract emails, IPs, usernames
   - File list table → extract filenames, IPs, timestamps
4. Pre-populate form fields
5. Allow manual correction
6. Copy PDF to `cases/{caseNumber}/cybertip/`

### Warrant Due Date Tracking
1. Dashboard queries: `WHERE received = 0 AND date_due < TODAY`
2. Display alert banner with count
3. Expandable list shows: Company, Case #, Days Overdue
4. Click → navigate to case warrant section

### Case Export Structure
```
Exported_Case_{caseNumber}_{date}/
├── Case_Summary.pdf (generated)
├── CyberTip_Data/
│   ├── NCMEC_Report.pdf
│   └── Evidence_Files/
├── Search_Warrants/
│   ├── {CompanyName}_{Date}/
│   │   ├── Signed_Warrant.pdf
│   │   └── Warrant_Returns/
├── Operations_Plan/
│   └── Operations_Plan.pdf
├── Suspect_Information/
│   ├── Suspect_Photo.jpg
│   └── Suspect_Profile.pdf (generated)
├── Case_Report.pdf
└── Prosecution_Documents/
    └── Prosecution_Info.pdf (generated)
```

### Rich Text Editor Requirements
- Fonts: Arial, Times New Roman, Calibri, Courier New, Georgia (5 total)
- Sizes: 8pt - 24pt
- Formatting: Bold, Italic, Underline, Bullets
- Export to PDF via jsPDF

## Security Considerations
- No network requests (except initial npm install during build)
- No telemetry or analytics
- All data stored locally in encrypted SQLite
- Hardware binding prevents unauthorized copying
- File paths stored relatively to prevent exposure
- No cloud backup services integration

## Testing Strategy
1. Unit tests for database operations
2. Integration tests for file uploads
3. Manual testing on clean Windows 10/11 machines
4. Test export on various case sizes (1-100 warrants)
5. Verify hardware binding across different machines
6. PDF parsing accuracy testing with sample NCMEC reports

## Rollout Notes
Since no updates possible:
- Comprehensive testing before deployment
- User documentation with screenshots
- Known limitations documented
- Backup/restore procedure documented
- Database corruption recovery plan
