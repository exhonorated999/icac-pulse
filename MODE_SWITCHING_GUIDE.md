# Mode Switching Guide - Testing Both Modes

## Understanding the Two Modes

ICAC P.U.L.S.E. operates in two distinct modes:

### 🖥️ Installed Mode (Default)
**When:** Running from desktop/laptop installation
**Behavior:**
- ✅ No login screen - auto-login as "Officer"
- ✅ Dashboard loads immediately
- ✅ Hardware-bound to computer
- ❌ No password required
- ❌ No Security section in Settings

**Use Case:** Single officer dedicated computer

### 💾 Portable Mode
**When:** Running from USB drive OR portable marker present
**Behavior:**
- ✅ Login/Registration screen required
- ✅ Username + Password required
- ✅ USB-bound to specific drive
- ✅ Security section visible in Settings
- ✅ Password change option available

**Use Case:** Multiple officers sharing USB drives

---

## How to Switch Modes

### Method 1: Quick Scripts (Recommended)

**Enable Portable Mode:**
```powershell
.\test-portable-mode.ps1
```

**Enable Installed Mode:**
```powershell
.\test-installed-mode.ps1
```

### Method 2: Manual Commands

**Enable Portable Mode:**
```powershell
# 1. Stop app
taskkill /F /IM electron.exe

# 2. Create portable marker
New-Item -Path "$env:APPDATA\ICAC_CaseManager\.portable" -ItemType File -Force

# 3. (Optional) Delete database for fresh registration
Remove-Item -Path "$env:APPDATA\ICAC_CaseManager\database.db" -Force

# 4. Restart
npm run dev
```

**Enable Installed Mode:**
```powershell
# 1. Stop app
taskkill /F /IM electron.exe

# 2. Remove portable marker
Remove-Item -Path "$env:APPDATA\ICAC_CaseManager\.portable" -Force

# 3. Restart
npm run dev
```

---

## What You'll See

### In Installed Mode

**Startup:**
```
Loading screen → Hardware check → Dashboard
```

**Settings:**
```
Settings Page
├── File Storage Location
├── Appearance (Theme Toggle)
├── API Keys & Integrations
└── License Agreement
    (No Security section)
```

**Header:**
```
Username: Officer (auto-assigned)
```

### In Portable Mode

**First Time (No User Registered):**
```
Loading screen → Registration Screen
├── Portable Mode Active badge
├── Username field
├── Password field (min 6 chars)
├── Confirm Password field
└── USB binding notice
```

**Subsequent Times:**
```
Loading screen → Login Screen
├── Portable Mode Active badge
├── Username field
├── Password field
└── Master recovery password hint
```

**Settings:**
```
Settings Page
├── File Storage Location
├── Appearance (Theme Toggle)
├── 🔒 Security (NEW!)
│   └── Change Password option
├── API Keys & Integrations
└── License Agreement
```

**Header:**
```
Username: [Your registered username]
```

---

## Testing Workflow

### Test 1: Installed Mode (Default)
```powershell
# Ensure installed mode
.\test-installed-mode.ps1

# Expected:
# ✓ Dashboard loads immediately
# ✓ No login screen
# ✓ No Security section in Settings
```

### Test 2: Portable Mode - First Time Registration
```powershell
# 1. Switch to portable mode WITH database reset
.\test-portable-mode.ps1
# Answer 'y' to delete database

# Expected:
# ✓ Registration screen appears
# ✓ "Portable Mode Active" badge visible
# ✓ Can create username and password
# ✓ After registration, dashboard loads
```

### Test 3: Portable Mode - Login
```powershell
# 1. Close app (Ctrl+C in terminal)

# 2. Restart (database still exists)
npm run dev

# Expected:
# ✓ Login screen appears
# ✓ "Portable Mode Active" badge visible
# ✓ Must enter correct credentials
# ✓ Dashboard loads after successful login
```

### Test 4: Password Change
```powershell
# Prerequisite: In portable mode, logged in

# 1. Navigate to Settings
# 2. Look for "Security" section

# Expected:
# ✓ Security section is visible
# ✓ "Change Password" button present
# ✓ Can change password with current/new/confirm
# ✓ Old password no longer works
# ✓ New password works for login
```

### Test 5: Master Recovery Password
```powershell
# Prerequisite: In portable mode, user registered

# 1. At login screen
# 2. Enter username: [your username]
# 3. Enter password: Ipreventcrime1!

# Expected:
# ✓ Login succeeds with master password
# ✓ Dashboard loads
# ✓ Can change password in Settings
```

---

## Common Scenarios

### Scenario 1: "I don't see the login screen!"
**Cause:** You're in installed mode
**Solution:** Run `.\test-portable-mode.ps1`

### Scenario 2: "There's no Security section in Settings!"
**Cause:** You're in installed mode
**Solution:** Run `.\test-portable-mode.ps1`

### Scenario 3: "I see the login screen but don't have a password!"
**Cause:** No user registered yet - it's showing registration screen
**Solution:** 
- If you want to register: Fill out the form
- If you want to skip: Run `.\test-installed-mode.ps1`

### Scenario 4: "I registered but forgot my password!"
**Solution:** 
1. At login screen
2. Username: [your username]
3. Password: `Ipreventcrime1!`
4. Go to Settings → Security → Change Password

### Scenario 5: "I want to test registration again!"
**Solution:**
```powershell
# Delete database and restart
Remove-Item -Path "$env:APPDATA\ICAC_CaseManager\database.db" -Force
taskkill /F /IM electron.exe
npm run dev
```

---

## Marker File Location

The portable mode is controlled by a simple marker file:

**Location:**
```
%APPDATA%\ICAC_CaseManager\.portable
```

**Full Path:**
```
C:\Users\[YourUsername]\AppData\Roaming\ICAC_CaseManager\.portable
```

**Check if it exists:**
```powershell
Test-Path "$env:APPDATA\ICAC_CaseManager\.portable"
```

**Create it:**
```powershell
New-Item -Path "$env:APPDATA\ICAC_CaseManager\.portable" -ItemType File -Force
```

**Delete it:**
```powershell
Remove-Item -Path "$env:APPDATA\ICAC_CaseManager\.portable" -Force
```

---

## Mode Detection Logic

```typescript
// In src/main/usbFingerprint.ts
export function isPortableMode(): boolean {
  // Check 1: Running from USB drive (A-H)
  const driveLetter = process.cwd().charAt(0).toUpperCase();
  const isUsbDrive = driveLetter >= 'A' && driveLetter <= 'H';
  
  // Check 2: .portable marker file exists
  const portableMarkerPath = path.join(getUserDataPath(), '.portable');
  const hasPortableMarker = fs.existsSync(portableMarkerPath);
  
  // Portable mode if EITHER condition is true
  return isUsbDrive || hasPortableMarker;
}
```

**Notes:**
- For testing on C: drive, we use the marker file
- For production USB, the drive letter detection works automatically
- The marker file allows testing portable mode without actual USB

---

## Quick Reference

| Feature | Installed Mode | Portable Mode |
|---------|---------------|---------------|
| Login Screen | ❌ No | ✅ Yes |
| Password | ❌ None | ✅ Required |
| Security in Settings | ❌ Hidden | ✅ Visible |
| Auto-Login | ✅ Yes | ❌ No |
| Hardware Binding | ✅ Computer | ✅ USB Drive |
| Username | "Officer" | Custom |

---

## Current Status

After running the commands above, you should now be in **Portable Mode** with:

✅ Login/Registration screen visible
✅ "Portable Mode Active" badge displayed
✅ Password authentication required
✅ Security section will appear in Settings after login

**Next:** Complete the registration or login to test the full security features!

---

## Scripts Available

- `test-portable-mode.ps1` - Enable portable mode for testing
- `test-installed-mode.ps1` - Enable installed mode (default)
- Both scripts automatically restart the dev server

**Usage:**
```powershell
# Make scripts executable (if needed)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# Run a script
.\test-portable-mode.ps1
```
