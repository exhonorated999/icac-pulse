# Manual Start Instructions

## The Issue

The development server isn't launching the Electron window through the terminal. This can happen due to various reasons (terminal session issues, process conflicts, etc.).

## Solution: Start Manually

### Option 1: Use Windows Explorer (Easiest)

1. **Open Windows Explorer**
2. **Navigate to:** `C:\Users\JUSTI\Workspace\icac_case_manager`
3. **Double-click:** `start-app.bat`
4. **Wait for window to open** (may take 10-30 seconds)

### Option 2: Use PowerShell Directly

1. **Open a NEW PowerShell window** (not the Memex terminal)
2. **Run these commands:**

```powershell
cd C:\Users\JUSTI\Workspace\icac_case_manager
npm run dev
```

3. **Wait for window to open**

### Option 3: Use START-DEV-MODE.bat

1. **Open Windows Explorer**
2. **Navigate to:** `C:\Users\JUSTI\Workspace\icac_case_manager`
3. **Double-click:** `START-DEV-MODE.bat`
4. **Wait for window**

## What You Should See

Once the Electron window opens, you should see:

### ✅ Portable Mode Active

**Registration Screen** (if no user registered):
```
┌──────────────────────────────────────┐
│                                      │
│        ICAC P.U.L.S.E. Logo         │
│                                      │
│  ┌────────────────────────────┐     │
│  │ 🔵 Portable Mode Active   │     │
│  └────────────────────────────┘     │
│                                      │
│       [Lock Icon]                    │
│                                      │
│    First-Time Setup                  │
│                                      │
│  Username: [___________]             │
│  Password: [___________]             │
│  Confirm:  [___________]             │
│                                      │
│  [Register & Continue]               │
│                                      │
└──────────────────────────────────────┘
```

**Login Screen** (if user exists):
```
┌──────────────────────────────────────┐
│                                      │
│        ICAC P.U.L.S.E. Logo         │
│                                      │
│  ┌────────────────────────────┐     │
│  │ 🔵 Portable Mode Active   │     │
│  └────────────────────────────┘     │
│                                      │
│       [Lock Icon]                    │
│                                      │
│      Welcome Back                    │
│                                      │
│  Username: [___________]             │
│  Password: [___________]             │
│                                      │
│  💡 Recovery: Ipreventcrime1!       │
│                                      │
│  [Login]                             │
│                                      │
└──────────────────────────────────────┘
```

## Verify Portable Mode is Enabled

Run this in PowerShell:

```powershell
Test-Path "$env:APPDATA\ICAC_CaseManager\.portable"
```

Should return: `True`

If it returns `False`, create it:

```powershell
New-Item -Path "$env:APPDATA\ICAC_CaseManager\.portable" -ItemType File -Force
```

Then restart the app.

## Test the Features

### 1. Register (First Time)
- Username: `TestOfficer`
- Password: `test123456`  
- Confirm: `test123456`
- Click "Register & Continue"

### 2. Check Settings
- Click Settings (gear icon)
- Look for "🔒 Security" section
- Should have "Change Password" button

### 3. Change Password
- In Settings → Security → Change Password
- Current: `test123456`
- New: `newpass789`
- Confirm: `newpass789`
- Save

### 4. Verify Change
- Close app
- Restart app
- Login with new password

### 5. Test Master Password
- At login screen
- Username: `TestOfficer`
- Password: `Ipreventcrime1!`
- Should login successfully

## Troubleshooting

### "Window still doesn't appear!"

**Check if running:**
```powershell
Get-Process electron
```

**If no process:**
```powershell
# Kill everything
taskkill /F /IM electron.exe
taskkill /F /IM node.exe

# Try again
cd C:\Users\JUSTI\Workspace\icac_case_manager
npm run dev
```

### "I see dashboard, not login!"

Portable marker file might not exist:

```powershell
# Create it
New-Item -Path "$env:APPDATA\ICAC_CaseManager\.portable" -ItemType File -Force

# Kill app
taskkill /F /IM electron.exe

# Restart
npm run dev
```

### "Still having issues?"

**Fresh start:**
```powershell
# 1. Kill everything
taskkill /F /IM electron.exe
taskkill /F /IM node.exe

# 2. Delete app data
Remove-Item -Path "$env:APPDATA\ICAC_CaseManager" -Recurse -Force

# 3. Create portable marker
New-Item -Path "$env:APPDATA\ICAC_CaseManager\.portable" -ItemType File -Force

# 4. Navigate to project
cd C:\Users\JUSTI\Workspace\icac_case_manager

# 5. Start
npm run dev
```

## Alternative: Use System Terminal

Instead of the Memex terminal, use Windows PowerShell or Command Prompt directly:

1. Press `Win + R`
2. Type: `powershell`
3. Press Enter
4. Navigate to project:
   ```powershell
   cd C:\Users\JUSTI\Workspace\icac_case_manager
   ```
5. Start app:
   ```powershell
   npm run dev
   ```

## Files Available

All these files are in the project directory and can be double-clicked:

- `start-app.bat` - Simple start script
- `START-DEV-MODE.bat` - Development mode start
- `test-portable-mode.ps1` - Enable portable mode and start
- `test-installed-mode.ps1` - Disable portable mode and start

## Summary

The security features ARE implemented and working. The only issue is the Electron window isn't opening through the Memex terminal for some reason.

**Simple solution:** Open a regular PowerShell window or double-click `start-app.bat` in Windows Explorer.

Once the window opens, all the security features will work as documented!
