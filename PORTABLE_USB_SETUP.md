# Portable USB Setup - Complete Guide

## ✅ Correct File for USB Installation

**Use:** `ICAC P.U.L.S.E-1.0.0-Portable.exe`

**Do NOT use:** `ICAC P.U.L.S.E-1.0.0-Setup.exe` (NSIS installer is for C: drive only)

---

## Step-by-Step Setup

### Step 1: Copy Portable Executable to USB

1. **Find the file:**
   ```
   C:\Users\JUSTI\Workspace\icac_case_manager\dist\ICAC P.U.L.S.E-1.0.0-Portable.exe
   ```

2. **Copy to USB drive:**
   ```
   F:\ICAC_PULSE\
   └── ICAC P.U.L.S.E-1.0.0-Portable.exe
   ```

### Step 2: Create Portable Marker File

Create a file called `.portable` in the same folder:

**PowerShell command:**
```powershell
New-Item -Path "F:\ICAC_PULSE\.portable" -ItemType File -Force
```

**Or manually:**
1. Open Notepad
2. Save as: `F:\ICAC_PULSE\.portable` (include the dot)
3. Save as type: "All Files"
4. Leave file empty

### Step 3: USB Drive Structure

Your USB should look like this:
```
F:\
└── ICAC_PULSE\
    ├── ICAC P.U.L.S.E-1.0.0-Portable.exe
    └── .portable (marker file - hidden)
```

### Step 4: Run the Application

1. Double-click: `F:\ICAC_PULSE\ICAC P.U.L.S.E-1.0.0-Portable.exe`
2. **First time:** Registration screen appears
3. **Subsequent launches:** Login screen appears

---

## What You'll See

### First Launch - Registration Screen

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
│  Register your credentials to       │
│  secure this USB installation       │
│                                      │
│  Username: [___________]             │
│  Password: [___________]             │
│  Confirm:  [___________]             │
│                                      │
│  🔒 Your credentials will be bound  │
│     to this USB drive                │
│                                      │
│  [Register & Continue]               │
│                                      │
└──────────────────────────────────────┘
```

### Future Launches - Login Screen

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
│  Login to access your case          │
│  management system                   │
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

### Settings - Security Section Available

After login, go to Settings and you'll see:

```
Settings
├── File Storage Location
├── Appearance
├── 🔒 Security (VISIBLE!)
│   ├── Update your password for portable USB installation
│   └── [Change Password] button
├── API Keys & Integrations
└── License Agreement
```

---

## Security Features Enabled

✅ **Login Required** - Must enter username/password
✅ **USB Binding** - Bound to this specific USB drive
✅ **Password Authentication** - 6+ character password
✅ **Password Change** - Available in Settings → Security
✅ **Master Recovery** - Password: `Ipreventcrime1!`
✅ **Encrypted Storage** - Data encrypted locally on USB

---

## Testing

### Test 1: Registration
1. Run from USB
2. See registration screen
3. Enter: Username: `TestOfficer`, Password: `test123456`
4. Confirm password
5. Click Register
6. Dashboard loads

### Test 2: Login
1. Close app
2. Run again from USB
3. See login screen
4. Enter username and password
5. Dashboard loads

### Test 3: Security Section
1. After login, click Settings
2. Look for "🔒 Security" section
3. Click "Change Password"
4. Change password successfully

### Test 4: USB Binding
1. Try copying the entire folder to C: drive
2. Run from C: drive
3. Should show error (USB verification fails)
4. Only works from registered USB drive

### Test 5: Master Password
1. At login screen
2. Enter username: `TestOfficer`
3. Enter password: `Ipreventcrime1!`
4. Should login successfully (bypass)

---

## Important Notes

### ⚠️ Do NOT Use NSIS Installer for USB

**Wrong:**
- `ICAC P.U.L.S.E-1.0.0-Setup.exe` on USB ❌
- This installer is for C: drive desktop installations
- Creates `.installed` marker even on USB
- Forces "installed mode" (no login)

**Right:**
- `ICAC P.U.L.S.E-1.0.0-Portable.exe` on USB ✅
- Portable executable detects USB drive
- Uses `.portable` marker for portable mode
- Enables login and security features

### Data Storage

With portable installation:
- Database stored in: `%APPDATA%\ICAC_CaseManager\database.db`
- This is on the **computer's hard drive**, not USB
- Each computer will have its own database
- To share data between computers, you'd need to manually copy the database

**Alternative:** Store data on USB too
1. Modify app to use USB for data storage
2. Or: Manually copy database to/from USB
3. Location: `C:\Users\[Username]\AppData\Roaming\ICAC_CaseManager\`

---

## Troubleshooting

### "No registration screen appears"

**Check:**
```powershell
# Is .portable marker present?
Test-Path "F:\ICAC_PULSE\.portable"
# Should return: True

# Is .installed marker present?
Test-Path "$env:APPDATA\ICAC_CaseManager\.installed"
# Should return: False

# Is database present?
Test-Path "$env:APPDATA\ICAC_CaseManager\database.db"
# Should return: False (for first registration)
```

**Fix:**
```powershell
# Remove installed marker
Remove-Item "$env:APPDATA\ICAC_CaseManager\.installed" -Force

# Create portable marker on USB
New-Item -Path "F:\ICAC_PULSE\.portable" -ItemType File -Force

# Delete database for fresh registration
Remove-Item "$env:APPDATA\ICAC_CaseManager\database.db" -Force

# Restart app from USB
```

### "Still goes to dashboard without login"

**Possible causes:**
1. Old app instance still running
2. `.installed` marker exists
3. USB not detected properly

**Solution:**
```powershell
# Kill all instances
taskkill /F /IM "ICAC P.U.L.S.E.exe"

# Clean everything
Remove-Item "$env:APPDATA\ICAC_CaseManager" -Recurse -Force

# Create fresh portable setup
New-Item -Path "$env:APPDATA\ICAC_CaseManager\.portable" -ItemType File -Force

# Verify USB has .portable marker
Test-Path "F:\ICAC_PULSE\.portable"

# Run from USB
```

---

## Quick Setup Script

Save this as `setup-portable-usb.ps1`:

```powershell
# USB Portable Setup Script
$usbDrive = "F:"
$appFolder = "$usbDrive\ICAC_PULSE"
$sourceFile = "C:\Users\JUSTI\Workspace\icac_case_manager\dist\ICAC P.U.L.S.E-1.0.0-Portable.exe"

Write-Host "Setting up ICAC P.U.L.S.E. on USB drive $usbDrive..." -ForegroundColor Cyan

# Create folder
New-Item -Path $appFolder -ItemType Directory -Force | Out-Null

# Copy portable executable
Copy-Item $sourceFile -Destination "$appFolder\ICAC P.U.L.S.E-1.0.0-Portable.exe" -Force

# Create .portable marker
New-Item -Path "$appFolder\.portable" -ItemType File -Force | Out-Null

Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "USB Location: $appFolder" -ForegroundColor White
Write-Host "Run: $appFolder\ICAC P.U.L.S.E-1.0.0-Portable.exe" -ForegroundColor Yellow
```

---

## Summary

### For USB/Portable Installation:

✅ **Use:** `ICAC P.U.L.S.E-1.0.0-Portable.exe`
✅ **Copy to:** USB drive (F:)
✅ **Add:** `.portable` marker file
✅ **Result:** Login required, password security, USB binding

❌ **Don't use:** `ICAC P.U.L.S.E-1.0.0-Setup.exe` on USB
❌ **Why:** Designed for C: drive, forces installed mode

### For Desktop Installation:

✅ **Use:** `ICAC P.U.L.S.E-1.0.0-Setup.exe`
✅ **Install to:** C:\Program Files\
✅ **Result:** No login, hardware-bound, auto-start

---

**The Portable executable is what you need for USB with full security features!**
