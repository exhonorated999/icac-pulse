# ICAC Case Manager - Setup Instructions

## Prerequisites

### 1. Install Node.js
Node.js is required to build and run this Electron application.

**Download & Install:**
- Visit: https://nodejs.org/
- Download the **LTS version** (Long Term Support)
- Run the installer (nodejs-vXX.XX.X-x64.msi)
- Follow installation wizard (keep default settings)
- Restart your terminal/PowerShell after installation

**Verify Installation:**
```powershell
node --version
npm --version
```

### 2. Install Dependencies
Once Node.js is installed, run from the project directory:

```powershell
cd C:\Users\Justi\Workspace\icac_case_manager
npm install
```

This will install all required packages (~2-5 minutes).

## Building the Application

### Development Mode (for testing during development)
```powershell
npm run dev
```
This starts the app with hot-reload enabled for development.

### Build Production .exe
```powershell
npm run build
npm run dist
```
The standalone .exe will be created in the `dist/` folder.

## First Launch

1. Double-click the .exe file
2. You'll be prompted to register (username only)
3. The app will bind to your hardware
4. Database and case folders will be created in:
   ```
   C:\Users\{YourUsername}\AppData\Roaming\ICAC_CaseManager\
   ```

## Project Structure

```
icac_case_manager/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts            # Main entry point
│   │   ├── database.ts         # SQLite operations
│   │   ├── hardware.ts         # Hardware ID generation
│   │   ├── fileManager.ts      # File system operations
│   │   └── pdfParser.ts        # NCMEC PDF parsing
│   ├── renderer/               # React frontend
│   │   ├── components/         # UI components
│   │   ├── pages/              # Main views
│   │   ├── services/           # API calls to main process
│   │   ├── styles/             # Tailwind configs
│   │   ├── App.tsx             # Root component
│   │   └── index.tsx           # React entry
│   └── shared/                 # Shared types/constants
├── public/                     # Static assets
├── electron-builder.yml        # Build configuration
├── package.json
├── tsconfig.json
└── tailwind.config.js
```

## Security Notes

- **Hardware Binding:** The application binds to your specific computer. If you move the .exe to another machine, it won't work.
- **Database Encryption:** All case data is encrypted using a hardware-derived key.
- **Offline Only:** No network requests are made. All data stays on your local machine.
- **No Updates:** Since no update mechanism exists, ensure thorough testing before deployment.

## Troubleshooting

### "npm command not found"
- Node.js not installed or not in PATH
- Restart PowerShell after installing Node.js
- Run: `$env:Path` to verify Node.js path is included

### Build fails
- Delete `node_modules/` folder
- Run `npm install` again
- Check Node.js version is 18+ LTS

### Database locked errors
- Close all instances of the app
- Check Task Manager for hung processes
- Restart computer if persistent

## Development Timeline

Based on the plan.md, full implementation will take approximately 4-6 weeks:
- Phase 1-2: Project setup, database (1 week)
- Phase 3-4: UI foundation, case creation (1-2 weeks)
- Phase 5-6: Shared components, case views (2 weeks)
- Phase 7-8: Export, packaging, testing (1-2 weeks)

I will build this systematically, testing each phase before moving forward.
