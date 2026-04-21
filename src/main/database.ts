import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { DBWrapper } from './db-wrapper';

// Safe logging function that won't throw EPIPE errors
function safeLog(...args: any[]) {
  try {
    safeLog(...args);
  } catch (err) {
    // Silently ignore logging errors
  }
}

let db: SqlJsDatabase | null = null;
let SQL: any = null;

/**
 * Detect if running in portable mode
 */
function isPortableMode(): boolean {
  // Check if portable.txt marker file exists next to executable
  const exePath = app.getPath('exe');
  const exeDir = path.dirname(exePath);
  const portableMarker = path.join(exeDir, 'portable.txt');
  
  // If marker exists, we're in portable mode
  if (fs.existsSync(portableMarker)) {
    return true;
  }
  
  // Check if executable name contains "Portable"
  if (exePath.includes('Portable')) {
    return true;
  }
  
  // Check if running from removable drive (D:, E:, F:, etc. - not C:)
  const driveLetter = exeDir.charAt(0).toUpperCase();
  if (driveLetter !== 'C' && /^[D-Z]$/.test(driveLetter)) {
    return true;
  }
  
  return false;
}

/**
 * Get the user data directory path
 * - Portable mode: stores data next to executable
 * - Installed mode: stores data on C: drive (bound to machine)
 */
export function getUserDataPath(): string {
  let userDataPath: string;
  
  if (isPortableMode()) {
    // Portable mode: Store data next to executable
    const exePath = app.getPath('exe');
    const exeDir = path.dirname(exePath);
    userDataPath = path.join(exeDir, 'ICAC_Data');
    safeLog('Running in PORTABLE mode. Data path:', userDataPath);
  } else {
    // Installed mode: Store data on C: drive in AppData
    // This binds the installation to the C: drive
    userDataPath = path.join('C:', 'ProgramData', 'ICAC_CaseManager');
    safeLog('Running in INSTALLED mode. Data path:', userDataPath);
  }
  
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  
  return userDataPath;
}

/**
 * Get the cases directory path
 */
export function getCasesPath(): string {
  // Check if custom path is set
  const configPath = path.join(getUserDataPath(), 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.casesPath && fs.existsSync(config.casesPath)) {
        return config.casesPath;
      }
    } catch (error) {
      safeLog('Failed to read config:', error);
    }
  }
  
  // Default path
  const casesPath = path.join(getUserDataPath(), 'cases');
  if (!fs.existsSync(casesPath)) {
    fs.mkdirSync(casesPath, { recursive: true });
  }
  return casesPath;
}

/**
 * Set the cases directory path
 */
export function setCasesPath(newPath: string): void {
  const configPath = path.join(getUserDataPath(), 'config.json');
  const config = fs.existsSync(configPath) 
    ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    : {};
  
  config.casesPath = newPath;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Initialize database connection and create tables
 */
export async function initDatabase(): Promise<SqlJsDatabase> {
  if (db) return db;

  // Initialize sql.js
  if (!SQL) {
    SQL = await initSqlJs();
  }

  const dbPath = path.join(getUserDataPath(), 'database.db');
  
  // Load existing database or create new
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');
  
  createTables();
  runMigrations();
  
  // Ensure a default user exists for installed mode
  // Portable mode creates users via REGISTER_USER, but installed mode skips registration
  const userCheck = db.exec('SELECT COUNT(*) FROM users');
  const userCount = userCheck.length > 0 ? (userCheck[0].values[0][0] as number) : 0;
  if (userCount === 0 && !isPortableMode()) {
    db.run("INSERT INTO users (username, hardware_id) VALUES ('Officer', 'installed-mode')");
    safeLog('Created default user for installed mode');
  }
  
  saveDatabase();
  
  return db;
}

/**
 * Get database instance (wrapped for better-sqlite3 compatibility)
 */
export function getDatabase(): DBWrapper {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return new DBWrapper(db);
}

/**
 * Get raw sql.js database instance (for operations that need it)
 */
export function getRawDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Save database to file
 */
export function saveDatabase(): void {
  if (!db) {
    // Silent - don't log
    return;
  }
  
  try {
    const dbPath = path.join(getUserDataPath(), 'database.db');
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    safeLog('Database saved successfully to:', dbPath);
  } catch (error) {
    // Silent error - just fail gracefully
    throw error;
  }
}

/**
 * Create all database tables
 * 
 * IMPORTANT: All DATETIME fields with DEFAULT CURRENT_TIMESTAMP are stored in UTC.
 * SQLite's CURRENT_TIMESTAMP function returns UTC time by default.
 * When manually inserting timestamps, always use Date.toISOString() which is UTC.
 * See UTC_TIMESTAMP_DOCUMENTATION.md for complete details.
 */
function createTables(): void {
  if (!db) return;

  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      hardware_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- UTC
      last_login DATETIME DEFAULT CURRENT_TIMESTAMP   -- UTC
    );

    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_number TEXT UNIQUE NOT NULL,
      case_type TEXT NOT NULL CHECK(case_type IN ('cybertip', 'p2p', 'chat', 'other')),
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'warrants_issued', 'ready_residential', 'arrest', 'closed_no_arrest', 'referred')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- UTC
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- UTC
      user_id INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS cybertip_data (
      case_id INTEGER PRIMARY KEY,
      cybertip_number TEXT NOT NULL,
      report_date TEXT NOT NULL,
      occurrence_date TEXT,
      reporting_company TEXT NOT NULL,
      priority_level TEXT,
      date_received_utc TEXT,
      ncmec_folder_path TEXT,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cybertip_identifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      identifier_type TEXT NOT NULL CHECK(identifier_type IN ('email', 'username', 'ip', 'phone', 'userid', 'name')),
      identifier_value TEXT NOT NULL,
      platform TEXT,
      provider TEXT,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cybertip_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      ip_address TEXT,
      datetime TEXT,
      officer_description TEXT,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS p2p_data (
      case_id INTEGER PRIMARY KEY,
      download_date TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('shareazza', 'bittorrent', 'freenet', 'other')),
      suspect_ip TEXT NOT NULL,
      ip_provider TEXT NOT NULL,
      download_folder_path TEXT,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_data (
      case_id INTEGER PRIMARY KEY,
      initial_contact_date TEXT NOT NULL,
      platform TEXT NOT NULL,
      identifiers TEXT NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS other_data (
      case_id INTEGER PRIMARY KEY,
      case_type_description TEXT NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS suspects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      name TEXT,
      dob TEXT,
      drivers_license TEXT,
      photo_path TEXT,
      address TEXT,
      height TEXT,
      weight TEXT,
      phone TEXT,
      workplace TEXT,
      has_weapons INTEGER DEFAULT 0,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS weapons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      suspect_id INTEGER NOT NULL,
      weapon_description TEXT NOT NULL,
      FOREIGN KEY (suspect_id) REFERENCES suspects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS warrants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      company_name TEXT NOT NULL,
      date_issued TEXT NOT NULL,
      date_served TEXT,
      date_due TEXT NOT NULL,
      received INTEGER DEFAULT 0,
      date_received TEXT,
      warrant_pdf_path TEXT,
      return_files_path TEXT,
      notes TEXT,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS operations_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      plan_pdf_path TEXT,
      approved INTEGER DEFAULT 0,
      approver_name TEXT,
      approval_date TEXT,
      execution_date TEXT,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS case_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prosecution_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      charges TEXT,
      court_case_number TEXT,
      assigned_court TEXT,
      da_name TEXT,
      da_contact TEXT,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS probable_cause (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER,
      content TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS case_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      file_path TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS public_outreach (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,                                      -- User-entered calendar date
      location TEXT NOT NULL,
      num_attendees INTEGER NOT NULL,
      is_law_enforcement INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,           -- UTC
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP            -- UTC
    );

    CREATE TABLE IF NOT EXISTS outreach_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_name TEXT NOT NULL,
      material_type TEXT NOT NULL,                             -- Powerpoint, PDF, Video, Worksheet, etc.
      file_path TEXT NOT NULL,                                 -- Relative path: outreach/filename.ext
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,           -- UTC
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP            -- UTC
    );

    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      resource_type TEXT,                                      -- PDF, Powerpoint, Video, Software, etc. (optional)
      file_path TEXT NOT NULL,                                 -- Relative path: resources/filename.ext
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,           -- UTC
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP            -- UTC
    );

    CREATE TABLE IF NOT EXISTS offense_reference (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      charge_code TEXT NOT NULL,                               -- e.g., "PC 311.11(a)"
      charge_description TEXT NOT NULL,                        -- Full description of charge
      seriousness TEXT NOT NULL,                               -- Felony, Misdemeanor, Infraction, etc.
      sentencing_range TEXT,                                   -- e.g., "2, 3, or 4 years"
      notes TEXT,                                              -- Jury instructions, additional info
      display_order INTEGER DEFAULT 0,                         -- For custom ordering
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,           -- UTC
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP            -- UTC
    );

    CREATE TABLE IF NOT EXISTS cdr_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      phone_a TEXT,
      phone_b TEXT,
      date_val TEXT,
      time_val TEXT,
      timestamp TEXT,
      call_type TEXT NOT NULL DEFAULT 'voice',
      duration_seconds INTEGER DEFAULT 0,
      imei TEXT,
      imsi TEXT,
      tower_a TEXT,
      tower_b TEXT,
      source TEXT,
      raw_line TEXT,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS aperture_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      message_id TEXT,
      from_address TEXT NOT NULL,
      to_addresses TEXT,
      cc_addresses TEXT,
      subject TEXT,
      date_sent TEXT NOT NULL,
      body_text TEXT,
      body_html TEXT,
      headers_raw TEXT,
      source_file TEXT,
      flagged INTEGER DEFAULT 0,
      ip_addresses TEXT,
      attachments_json TEXT,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS timeline_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      end_timestamp TEXT,
      title TEXT NOT NULL,
      description TEXT,
      lane TEXT NOT NULL CHECK(lane IN ('incident', 'investigative', 'forensics')),
      category TEXT NOT NULL DEFAULT 'custom',
      significance TEXT NOT NULL DEFAULT 'major' CHECK(significance IN ('major', 'supporting')),
      entity_link TEXT,
      source_type TEXT NOT NULL DEFAULT 'manual',
      source_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_timeline_events_case_id ON timeline_events(case_id);
    CREATE INDEX IF NOT EXISTS idx_cdr_records_case_id ON cdr_records(case_id);
    CREATE INDEX IF NOT EXISTS idx_aperture_emails_case_id ON aperture_emails(case_id);

    CREATE INDEX IF NOT EXISTS idx_cases_user_id ON cases(user_id);
    CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
    CREATE INDEX IF NOT EXISTS idx_cases_type ON cases(case_type);
    CREATE INDEX IF NOT EXISTS idx_warrants_case_id ON warrants(case_id);
    CREATE INDEX IF NOT EXISTS idx_warrants_received ON warrants(received);
    CREATE INDEX IF NOT EXISTS idx_todos_case_id ON todos(case_id);
    CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
    CREATE INDEX IF NOT EXISTS idx_case_notes_case_id ON case_notes(case_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_case_id ON evidence(case_id);
    CREATE INDEX IF NOT EXISTS idx_public_outreach_date ON public_outreach(date);
    CREATE INDEX IF NOT EXISTS idx_outreach_materials_type ON outreach_materials(material_type);
    CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type);
    CREATE INDEX IF NOT EXISTS idx_offense_reference_seriousness ON offense_reference(seriousness);
    CREATE INDEX IF NOT EXISTS idx_offense_reference_order ON offense_reference(display_order);
  `;

  // Execute all statements
  db.exec(schema);
}

/**
 * Run database migrations for existing databases
 */
function runMigrations(): void {
  if (!db) return;
  
  safeLog('Running database migrations...');
  
  try {
    // Migration 1: Add missing columns to warrants table
    const warrantColumns = db.exec("PRAGMA table_info(warrants)");
    const columnNames = warrantColumns.length > 0 
      ? warrantColumns[0].values.map(row => row[1]) 
      : [];
    
    if (!columnNames.includes('date_served')) {
      safeLog('Adding date_served column to warrants table');
      db.run('ALTER TABLE warrants ADD COLUMN date_served TEXT');
    }
    
    if (!columnNames.includes('notes')) {
      safeLog('Adding notes column to warrants table');
      db.run('ALTER TABLE warrants ADD COLUMN notes TEXT');
    }
    
    if (!columnNames.includes('warrant_pdf_path')) {
      safeLog('Adding warrant_pdf_path column to warrants table');
      db.run('ALTER TABLE warrants ADD COLUMN warrant_pdf_path TEXT');
    }
    
    if (!columnNames.includes('return_files_path')) {
      safeLog('Adding return_files_path column to warrants table');
      db.run('ALTER TABLE warrants ADD COLUMN return_files_path TEXT');
    }
    
    // Migration 2: Add platform and provider columns to cybertip_identifiers
    const identifierColumns = db.exec("PRAGMA table_info(cybertip_identifiers)");
    const idColumnNames = identifierColumns.length > 0 
      ? identifierColumns[0].values.map(row => row[1]) 
      : [];
    
    if (!idColumnNames.includes('platform')) {
      safeLog('Adding platform column to cybertip_identifiers table');
      db.run('ALTER TABLE cybertip_identifiers ADD COLUMN platform TEXT');
    }
    
    if (!idColumnNames.includes('provider')) {
      safeLog('Adding provider column to cybertip_identifiers table');
      db.run('ALTER TABLE cybertip_identifiers ADD COLUMN provider TEXT');
    }
    
    // Migration 3: Fix old warrant paths that are missing case number prefix
    safeLog('Checking for warrant paths that need fixing...');
    const warrantsToFix = db.exec(`
      SELECT w.id, w.warrant_pdf_path, w.return_files_path, c.case_number
      FROM warrants w
      JOIN cases c ON w.case_id = c.id
      WHERE (w.warrant_pdf_path IS NOT NULL AND w.warrant_pdf_path NOT LIKE c.case_number || '%')
         OR (w.return_files_path IS NOT NULL AND w.return_files_path NOT LIKE c.case_number || '%')
    `);
    
    if (warrantsToFix.length > 0 && warrantsToFix[0].values.length > 0) {
      safeLog(`Found ${warrantsToFix[0].values.length} warrant(s) with incorrect paths`);
      
      for (const row of warrantsToFix[0].values) {
        const [warrantId, warrantPdfPath, returnFilesPath, caseNumber] = row;
        
        // Fix warrant_pdf_path if it exists and doesn't start with case number
        if (warrantPdfPath && !warrantPdfPath.startsWith(caseNumber + '/')) {
          const fixedPdfPath = `${caseNumber}/${warrantPdfPath}`;
          safeLog(`Fixing warrant PDF path: ${warrantPdfPath} -> ${fixedPdfPath}`);
          db.run('UPDATE warrants SET warrant_pdf_path = ? WHERE id = ?', [fixedPdfPath, warrantId]);
        }
        
        // Fix return_files_path if it exists and doesn't start with case number
        if (returnFilesPath && !returnFilesPath.startsWith(caseNumber + '/')) {
          const fixedReturnPath = `${caseNumber}/${returnFilesPath}`;
          safeLog(`Fixing warrant return path: ${returnFilesPath} -> ${fixedReturnPath}`);
          db.run('UPDATE warrants SET return_files_path = ? WHERE id = ?', [fixedReturnPath, warrantId]);
        }
      }
      
      saveDatabase();
      safeLog('Warrant paths fixed successfully');
    } else {
      safeLog('No warrant paths need fixing');
    }
    
    // Migration 4: Add new suspect fields (first_name, last_name, vehicle info)
    try {
      const suspectColumns = db.exec("PRAGMA table_info(suspects)");
      const suspectColumnNames = suspectColumns.length > 0 
        ? suspectColumns[0].values.map(row => row[1]) 
        : [];
      
      if (!suspectColumnNames.includes('first_name')) {
        safeLog('Adding first_name column to suspects table');
        db.run('ALTER TABLE suspects ADD COLUMN first_name TEXT');
      }
      
      if (!suspectColumnNames.includes('last_name')) {
        safeLog('Adding last_name column to suspects table');
        db.run('ALTER TABLE suspects ADD COLUMN last_name TEXT');
      }
      
      if (!suspectColumnNames.includes('vehicle_make')) {
        safeLog('Adding vehicle_make column to suspects table');
        db.run('ALTER TABLE suspects ADD COLUMN vehicle_make TEXT');
      }
      
      if (!suspectColumnNames.includes('vehicle_model')) {
        safeLog('Adding vehicle_model column to suspects table');
        db.run('ALTER TABLE suspects ADD COLUMN vehicle_model TEXT');
      }
      
      if (!suspectColumnNames.includes('vehicle_color')) {
        safeLog('Adding vehicle_color column to suspects table');
        db.run('ALTER TABLE suspects ADD COLUMN vehicle_color TEXT');
      }
      
      // Add hair_color column if not exists
      if (!suspectColumnNames.includes('hair_color')) {
        safeLog('Adding hair_color column to suspects table');
        db.run('ALTER TABLE suspects ADD COLUMN hair_color TEXT');
      }
      
      // Add eye_color column if not exists
      if (!suspectColumnNames.includes('eye_color')) {
        safeLog('Adding eye_color column to suspects table');
        db.run('ALTER TABLE suspects ADD COLUMN eye_color TEXT');
      }
      
      // Add place_of_work column if not exists (fixing the naming)
      if (!suspectColumnNames.includes('place_of_work')) {
        safeLog('Adding place_of_work column to suspects table');
        db.run('ALTER TABLE suspects ADD COLUMN place_of_work TEXT');
      }
      
      // Add phone_carrier column if not exists
      if (!suspectColumnNames.includes('phone_carrier')) {
        safeLog('Adding phone_carrier column to suspects table');
        db.run('ALTER TABLE suspects ADD COLUMN phone_carrier TEXT');
      }
      
      // Add phone_line_type column if not exists
      if (!suspectColumnNames.includes('phone_line_type')) {
        safeLog('Adding phone_line_type column to suspects table');
        db.run('ALTER TABLE suspects ADD COLUMN phone_line_type TEXT');
      }
      
      // Create suspect_photos table for multiple photos
      safeLog('Creating suspect_photos table if not exists');
      db.run(`
        CREATE TABLE IF NOT EXISTS suspect_photos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          suspect_id INTEGER NOT NULL,
          photo_path TEXT NOT NULL,
          photo_type TEXT NOT NULL,
          description TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (suspect_id) REFERENCES suspects(id) ON DELETE CASCADE
        )
      `);
      
      safeLog('Suspect migration completed successfully');
    } catch (suspectMigrationError) {
      safeLog('Suspect migration error:', suspectMigrationError);
      // Don't throw - allow app to continue
    }
    
    // Migration 5: Add prosecution fields
    try {
      const prosecutionColumns = db.exec("PRAGMA table_info(prosecution_info)");
      const prosecutionColumnNames = prosecutionColumns.length > 0 
        ? prosecutionColumns[0].values.map(row => row[1]) 
        : [];
      
      if (!prosecutionColumnNames.includes('convicted')) {
        safeLog('Adding convicted column to prosecution_info table');
        db.run('ALTER TABLE prosecution_info ADD COLUMN convicted INTEGER DEFAULT 0');
      }
      
      if (!prosecutionColumnNames.includes('sentence')) {
        safeLog('Adding sentence column to prosecution_info table');
        db.run('ALTER TABLE prosecution_info ADD COLUMN sentence TEXT');
      }
      
      safeLog('Prosecution migration completed successfully');
    } catch (prosecutionMigrationError) {
      safeLog('Prosecution migration error:', prosecutionMigrationError);
      // Don't throw - allow app to continue
    }
    
    // Migration 6: Add file_path and ncmec_filename to cybertip_files
    try {
      const cybertipFileColumns = db.exec("PRAGMA table_info(cybertip_files)");
      const cybertipFileColumnNames = cybertipFileColumns.length > 0 
        ? cybertipFileColumns[0].values.map(row => row[1]) 
        : [];
      
      if (!cybertipFileColumnNames.includes('file_path')) {
        safeLog('Adding file_path column to cybertip_files table');
        db.run('ALTER TABLE cybertip_files ADD COLUMN file_path TEXT');
      }
      
      if (!cybertipFileColumnNames.includes('ncmec_filename')) {
        safeLog('Adding ncmec_filename column to cybertip_files table');
        db.run('ALTER TABLE cybertip_files ADD COLUMN ncmec_filename TEXT');
      }
      
      if (!cybertipFileColumnNames.includes('csam_description')) {
        safeLog('Adding csam_description column to cybertip_files table');
        db.run('ALTER TABLE cybertip_files ADD COLUMN csam_description TEXT');
      }
      
      safeLog('CyberTip files migration completed successfully');
    } catch (cybertipFilesMigrationError) {
      safeLog('CyberTip files migration error:', cybertipFilesMigrationError);
      // Don't throw - allow app to continue
    }
    
    // Migration 7: Update status values (waiting_warrants -> warrants_issued) and fix CHECK constraint
    try {
      safeLog('Starting status values migration...');
      
      // Check if migration already completed by testing if we can insert warrants_issued
      try {
        const testStmt = db.prepare("SELECT 1 FROM cases WHERE status = 'warrants_issued' LIMIT 1");
        const testResult = testStmt.get();
        
        // If we can query warrants_issued without error, migration likely done
        safeLog('Status migration may have already run, checking constraint...');
      } catch (testError) {
        safeLog('Status migration needed, proceeding...');
      }
      
      // Only proceed if cases_new doesn't already exist
      const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='cases_new'");
      if (tables.length > 0 && tables[0].values.length > 0) {
        safeLog('cases_new already exists, cleaning up...');
        db.run('DROP TABLE IF EXISTS cases_new');
      }
      
      // First, update any existing data using old status names
      try {
        db.run(`
          UPDATE cases 
          SET status = 'warrants_issued' 
          WHERE status = 'waiting_warrants'
        `);
        safeLog('Updated existing status values');
      } catch (updateError) {
        safeLog('Status update error (may be expected):', updateError);
      }
      
      // SQLite doesn't allow ALTER TABLE to modify CHECK constraints
      // We need to recreate the table with the new constraint
      
      safeLog('Recreating cases table with updated status constraint...');
      
      // Disable foreign keys temporarily
      db.run('PRAGMA foreign_keys = OFF');
      
      // Step 1: Create new table with correct constraint
      db.run(`
        CREATE TABLE cases_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          case_number TEXT UNIQUE NOT NULL,
          case_type TEXT NOT NULL CHECK(case_type IN ('cybertip', 'p2p', 'chat', 'other')),
          status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'warrants_issued', 'ready_residential', 'arrest', 'closed_no_arrest', 'referred')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          user_id INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);
      
      // Step 2: Copy all data from old table to new table
      db.run(`
        INSERT INTO cases_new (id, case_number, case_type, status, created_at, updated_at, user_id)
        SELECT id, case_number, case_type, status, created_at, updated_at, user_id
        FROM cases
      `);
      
      // Step 3: Drop old table
      db.run('DROP TABLE cases');
      
      // Step 4: Rename new table to original name
      db.run('ALTER TABLE cases_new RENAME TO cases');
      
      // Step 5: Recreate indexes
      db.run('CREATE INDEX IF NOT EXISTS idx_cases_user_id ON cases(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status)');
      db.run('CREATE INDEX IF NOT EXISTS idx_cases_type ON cases(case_type)');
      
      // Re-enable foreign keys
      db.run('PRAGMA foreign_keys = ON');
      
      // Save database
      saveDatabase();
      
      safeLog('Status values migration completed successfully');
    } catch (statusMigrationError) {
      safeLog('Status migration error:', statusMigrationError);
      safeLog('This may require manual database reset. See DATABASE_RESET_INSTRUCTIONS.md');
      // Don't throw - this is critical but we want to see the error
    }
    
    // Migration 8: Enhance todos table with due_date and file_path
    try {
      const todosColumns = db.exec("PRAGMA table_info(todos)");
      const todosColumnNames = todosColumns.length > 0 
        ? todosColumns[0].values.map(row => row[1]) 
        : [];
      
      if (!todosColumnNames.includes('due_date')) {
        safeLog('Adding due_date column to todos table');
        db.run('ALTER TABLE todos ADD COLUMN due_date TEXT');
      }
      
      if (!todosColumnNames.includes('file_path')) {
        safeLog('Adding file_path column to todos table');
        db.run('ALTER TABLE todos ADD COLUMN file_path TEXT');
      }
      
      if (!todosColumnNames.includes('file_name')) {
        safeLog('Adding file_name column to todos table');
        db.run('ALTER TABLE todos ADD COLUMN file_name TEXT');
      }
      
      safeLog('Todos enhancement migration completed successfully');
    } catch (todosMigrationError) {
      safeLog('Todos migration error:', todosMigrationError);
      // Don't throw - allow app to continue
    }
    
    // Migration: Add chat_identifiers and other_identifiers tables
    try {
      safeLog('Creating chat_identifiers table if not exists');
      db.run(`
        CREATE TABLE IF NOT EXISTS chat_identifiers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          case_id INTEGER NOT NULL,
          identifier_type TEXT NOT NULL CHECK(identifier_type IN ('email', 'username', 'ip', 'phone', 'userid', 'name')),
          identifier_value TEXT NOT NULL,
          platform TEXT,
          provider TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
        )
      `);
      
      safeLog('Creating other_identifiers table if not exists');
      db.run(`
        CREATE TABLE IF NOT EXISTS other_identifiers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          case_id INTEGER NOT NULL,
          identifier_type TEXT NOT NULL CHECK(identifier_type IN ('email', 'username', 'ip', 'phone', 'userid', 'name')),
          identifier_value TEXT NOT NULL,
          platform TEXT,
          provider TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
        )
      `);
      
      safeLog('Chat and Other identifiers tables migration completed successfully');
    } catch (identifiersMigrationError) {
      safeLog('Identifiers tables migration error:', identifiersMigrationError);
      // Don't throw - allow app to continue
    }
    
    // Migration: Add category column to offense_reference
    try {
      const offenseColumns = db.exec("PRAGMA table_info(offense_reference)");
      const offenseColumnNames = offenseColumns.length > 0 
        ? offenseColumns[0].values.map(row => row[1]) 
        : [];
      
      if (!offenseColumnNames.includes('category')) {
        safeLog('Adding category column to offense_reference table');
        db.run("ALTER TABLE offense_reference ADD COLUMN category TEXT DEFAULT 'state' CHECK(category IN ('state', 'federal'))");
      }
      
      // Always ensure existing records have a category value
      safeLog('Updating offense records to ensure category is set...');
      db.run("UPDATE offense_reference SET category = 'state' WHERE category IS NULL OR category = ''");
      
      const checkStmt = db.prepare("SELECT COUNT(*) as count FROM offense_reference WHERE category IS NULL OR category = ''");
      const checkResult = checkStmt.get();
      safeLog('Offenses without category after update:', checkResult.count);
      
      saveDatabase();
      safeLog('Offense category migration completed successfully');
    } catch (offenseMigrationError) {
      safeLog('Offense category migration error:', offenseMigrationError);
      // Don't throw - allow app to continue
    }
    
    // Migration 10: Add GPS coordinates to suspects table
    try {
      const suspectColumns2 = db.exec("PRAGMA table_info(suspects)");
      const suspectColumnNames2 = suspectColumns2.length > 0 
        ? suspectColumns2[0].values.map(row => row[1]) 
        : [];
      
      if (!suspectColumnNames2.includes('latitude')) {
        safeLog('Adding latitude column to suspects table');
        db.run('ALTER TABLE suspects ADD COLUMN latitude REAL');
      }
      
      if (!suspectColumnNames2.includes('longitude')) {
        safeLog('Adding longitude column to suspects table');
        db.run('ALTER TABLE suspects ADD COLUMN longitude REAL');
      }
      
      if (!suspectColumnNames2.includes('geocoded_date')) {
        safeLog('Adding geocoded_date column to suspects table');
        db.run('ALTER TABLE suspects ADD COLUMN geocoded_date TEXT');
      }
      
      saveDatabase();
      safeLog('GPS coordinates migration completed successfully');
    } catch (gpsMigrationError) {
      safeLog('GPS coordinates migration error:', gpsMigrationError);
      // Don't throw - allow app to continue
    }
    
    // Migration 11: Add phone location to suspects table
    try {
      const suspectColumns3 = db.exec("PRAGMA table_info(suspects)");
      const suspectColumnNames3 = suspectColumns3.length > 0 
        ? suspectColumns3[0].values.map(row => row[1]) 
        : [];
      
      if (!suspectColumnNames3.includes('phone_location')) {
        safeLog('Adding phone_location column to suspects table');
        db.run('ALTER TABLE suspects ADD COLUMN phone_location TEXT');
      }
      
      saveDatabase();
      safeLog('Phone location migration completed successfully');
    } catch (phoneLocationMigrationError) {
      safeLog('Phone location migration error:', phoneLocationMigrationError);
      // Don't throw - allow app to continue
    }
    
    // Migration 12: Add license plate to suspects table
    try {
      const suspectColumns4 = db.exec("PRAGMA table_info(suspects)");
      const suspectColumnNames4 = suspectColumns4.length > 0 
        ? suspectColumns4[0].values.map(row => row[1]) 
        : [];
      
      if (!suspectColumnNames4.includes('license_plate')) {
        safeLog('Adding license_plate column to suspects table');
        db.run('ALTER TABLE suspects ADD COLUMN license_plate TEXT');
      }
      
      saveDatabase();
      safeLog('License plate migration completed successfully');
    } catch (licensePlateMigrationError) {
      safeLog('License plate migration error:', licensePlateMigrationError);
      // Don't throw - allow app to continue
    }
    
    // Migration 13: Add category column to evidence table
    try {
      const evidenceColumns = db.exec("PRAGMA table_info(evidence)");
      const evidenceColumnNames = evidenceColumns.length > 0
        ? evidenceColumns[0].values.map(row => row[1])
        : [];

      if (!evidenceColumnNames.includes('category')) {
        safeLog('Adding category column to evidence table');
        db.run("ALTER TABLE evidence ADD COLUMN category TEXT NOT NULL DEFAULT 'Other'");
        saveDatabase();
      }
      safeLog('Evidence category migration completed successfully');
    } catch (evidenceCategoryMigrationError) {
      safeLog('Evidence category migration error:', evidenceCategoryMigrationError);
    }

    // Migration 14: Create chat_highlights table for persisted investigative viewer annotations
    try {
      const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_highlights'");
      if (!tables.length || !tables[0].values.length) {
        db.run(`
          CREATE TABLE IF NOT EXISTS chat_highlights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            evidence_id INTEGER NOT NULL,
            color TEXT NOT NULL DEFAULT 'yellow',
            text_content TEXT NOT NULL,
            xpath TEXT NOT NULL,
            start_offset INTEGER NOT NULL,
            end_offset INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE
          )
        `);
        db.run('CREATE INDEX IF NOT EXISTS idx_chat_highlights_evidence ON chat_highlights(evidence_id)');
        saveDatabase();
        safeLog('chat_highlights table created');
      }
    } catch (chatHighlightsMigrationError) {
      safeLog('chat_highlights migration error:', chatHighlightsMigrationError);
    }

    // Migration 15: Rebuild cdr_records table with expanded schema (phoneA/B, IMEI, IMSI, towers)
    try {
      const cdrColumns = db.exec("PRAGMA table_info(cdr_records)");
      const cdrColumnNames = cdrColumns.length > 0
        ? cdrColumns[0].values.map(row => row[1])
        : [];
      
      if (cdrColumnNames.includes('other_party') || !cdrColumnNames.includes('phone_a')) {
        safeLog('Rebuilding cdr_records table with new CDR schema');
        db.run('DROP TABLE IF EXISTS cdr_records');
        db.run(`CREATE TABLE IF NOT EXISTS cdr_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          case_id INTEGER NOT NULL,
          phone_a TEXT,
          phone_b TEXT,
          date_val TEXT,
          time_val TEXT,
          timestamp TEXT,
          call_type TEXT NOT NULL DEFAULT 'voice',
          duration_seconds INTEGER DEFAULT 0,
          imei TEXT,
          imsi TEXT,
          tower_a TEXT,
          tower_b TEXT,
          source TEXT,
          raw_line TEXT,
          FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
        )`);
        saveDatabase();
        safeLog('cdr_records table rebuilt successfully');
      }
    } catch (cdrMigrationError) {
      safeLog('cdr_records migration error:', cdrMigrationError);
    }

    // Migration 16: Add aperture_notes table + source_name column for VIPER-style Aperture
    try {
      // Add source_name column to aperture_emails if missing
      const aeColumns = db.exec("PRAGMA table_info(aperture_emails)");
      const aeColNames = aeColumns.length > 0
        ? aeColumns[0].values.map(row => row[1])
        : [];

      if (!aeColNames.includes('source_name')) {
        safeLog('Adding source_name column to aperture_emails');
        db.run('ALTER TABLE aperture_emails ADD COLUMN source_name TEXT');
      }

      // Create aperture_notes table
      db.run(`CREATE TABLE IF NOT EXISTS aperture_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        email_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
        FOREIGN KEY (email_id) REFERENCES aperture_emails(id) ON DELETE CASCADE
      )`);
      db.run('CREATE INDEX IF NOT EXISTS idx_aperture_notes_email_id ON aperture_notes(email_id)');
      saveDatabase();
      safeLog('Migration 16 (aperture_notes + source_name) completed');
    } catch (m16err) {
      safeLog('Migration 16 error:', m16err);
    }

    // Migration 17: Expand operations_plans with full OPS plan fields + related tables
    try {
      const opColsRaw = db.exec("PRAGMA table_info(operations_plans)");
      const opColNames = opColsRaw.length > 0 ? opColsRaw[0].values.map((r: any) => r[1]) : [];

      const newCols: [string, string][] = [
        ['date', 'TEXT'], ['time', 'TEXT'], ['report_number', 'TEXT'], ['case_agent', 'TEXT'],
        ['operation_type', 'TEXT'], ['location', 'TEXT'], ['briefing_location', 'TEXT'],
        ['fortifications', 'TEXT'], ['cameras', 'TEXT'], ['dogs', 'TEXT'], ['children', 'TEXT'],
        ['notifications', 'TEXT'], ['comms', 'TEXT'], ['hospital', 'TEXT'], ['rally_point', 'TEXT'],
        ['suspect_info', 'TEXT'], ['case_summary', 'TEXT'],
        ['tactical_plan', 'TEXT'], ['pursuit_plan', 'TEXT'], ['medical_plan', 'TEXT'],
        ['barricade_plan', 'TEXT'], ['contingency_plan', 'TEXT'],
        ['directions', 'TEXT'], ['location_photos', 'TEXT'],
        ['route_data', 'TEXT'],
      ];
      for (const [col, type] of newCols) {
        if (!opColNames.includes(col)) {
          db.run(`ALTER TABLE operations_plans ADD COLUMN ${col} ${type}`);
        }
      }

      // Entry team table
      db.run(`CREATE TABLE IF NOT EXISTS ops_entry_team (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ops_plan_id INTEGER NOT NULL,
        name TEXT,
        assignment TEXT,
        vehicle TEXT,
        call_sign TEXT,
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (ops_plan_id) REFERENCES operations_plans(id) ON DELETE CASCADE
      )`);

      // Other residents table
      db.run(`CREATE TABLE IF NOT EXISTS ops_other_residents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ops_plan_id INTEGER NOT NULL,
        name TEXT,
        dob TEXT,
        photo TEXT,
        has_firearms INTEGER DEFAULT 0,
        firearms TEXT,
        has_crim_history INTEGER DEFAULT 0,
        crim_history TEXT,
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (ops_plan_id) REFERENCES operations_plans(id) ON DELETE CASCADE
      )`);

      saveDatabase();
      safeLog('Migration 17 (ops plan expansion) completed');
    } catch (m17err) {
      safeLog('Migration 17 error:', m17err);
    }

    // Migration 18: Add firearms_info and criminal_history to suspects
    try {
      const susColsRaw18 = db.exec("PRAGMA table_info(suspects)");
      const susColNames18 = susColsRaw18.length > 0 ? susColsRaw18[0].values.map((r: any) => r[1]) : [];
      if (!susColNames18.includes('firearms_info')) {
        db.run('ALTER TABLE suspects ADD COLUMN firearms_info TEXT');
      }
      if (!susColNames18.includes('firearms_pdf_path')) {
        db.run('ALTER TABLE suspects ADD COLUMN firearms_pdf_path TEXT');
      }
      if (!susColNames18.includes('criminal_history')) {
        db.run('ALTER TABLE suspects ADD COLUMN criminal_history TEXT');
      }
      if (!susColNames18.includes('criminal_history_pdf_path')) {
        db.run('ALTER TABLE suspects ADD COLUMN criminal_history_pdf_path TEXT');
      }
      saveDatabase();
      safeLog('Migration 18 (suspect firearms/crim history) completed');
    } catch (m18err) {
      safeLog('Migration 18 error:', m18err);
    }

    // Migration 19: Add scars_marks_tattoos and license_plate to suspects
    try {
      const susColsRaw19 = db.exec("PRAGMA table_info(suspects)");
      const susColNames19 = susColsRaw19.length > 0 ? susColsRaw19[0].values.map((r: any) => r[1]) : [];
      if (!susColNames19.includes('scars_marks_tattoos')) {
        db.run('ALTER TABLE suspects ADD COLUMN scars_marks_tattoos TEXT');
      }
      if (!susColNames19.includes('license_plate')) {
        db.run('ALTER TABLE suspects ADD COLUMN license_plate TEXT');
      }
      saveDatabase();
      safeLog('Migration 19 (suspect scars/tattoos + license_plate) completed');
    } catch (m19err) {
      safeLog('Migration 19 error:', m19err);
    }

    // Migration 20: Create timeline_events table for existing databases
    try {
      db.run(`CREATE TABLE IF NOT EXISTS timeline_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        end_timestamp TEXT,
        title TEXT NOT NULL,
        description TEXT,
        lane TEXT NOT NULL CHECK(lane IN ('incident', 'investigative', 'forensics')),
        category TEXT NOT NULL DEFAULT 'custom',
        significance TEXT NOT NULL DEFAULT 'major' CHECK(significance IN ('major', 'supporting')),
        entity_link TEXT,
        source_type TEXT NOT NULL DEFAULT 'manual',
        source_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
      )`);
      db.run('CREATE INDEX IF NOT EXISTS idx_timeline_events_case_id ON timeline_events(case_id)');
      saveDatabase();
      safeLog('Migration 20 (timeline_events) completed');
    } catch (m20err) {
      safeLog('Migration 20 error:', m20err);
    }

    safeLog('Database migrations completed');
  } catch (error) {
    safeLog('Migration error:', error);
  }
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}

