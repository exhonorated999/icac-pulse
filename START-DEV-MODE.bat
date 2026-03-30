@echo off
cls
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                                                                              ║
echo ║              ICAC CASE MANAGER - DEVELOPMENT MODE                            ║
echo ║                                                                              ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.
echo Starting development server...
echo The application will open in a few seconds.
echo.
echo ┌──────────────────────────────────────────────────────────────────────────────┐
echo │  TEST THESE NEW FEATURES:                                                   │
echo ├──────────────────────────────────────────────────────────────────────────────┤
echo │  1. Click "Offense Reference" in sidebar (Red gavel icon)                   │
echo │     - Add a charge (e.g., PC 311.11(a))                                     │
echo │     - Try searching (e.g., "manufacture", "hidden camera", "311")           │
echo │     - Test drag-and-drop reordering                                         │
echo │                                                                              │
echo │  2. Click "Resources" in sidebar (Teal icon)                                │
echo │     - Upload a training document                                            │
echo │                                                                              │
echo │  3. Go to "Public Outreach"                                                 │
echo │     - Scroll down to see Materials section                                  │
echo │     - Add a presentation file                                               │
echo │                                                                              │
echo │  4. Go to "Settings"                                                        │
echo │     - Look for "Change Location" button                                     │
echo │                                                                              │
echo │  5. Go to "Dashboard"                                                       │
echo │     - Generate a PDF report to see page break fix                           │
echo └──────────────────────────────────────────────────────────────────────────────┘
echo.
echo ⚠️  Keep this window open while testing
echo ⚠️  Press Ctrl+C here to stop the dev server when done
echo.
echo ════════════════════════════════════════════════════════════════════════════════
echo.

cd /d H:\Workspace\icac_case_manager
npm run dev
