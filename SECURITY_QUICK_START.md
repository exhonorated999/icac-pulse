# Security Features - Quick Start Guide

## 🚀 Quick Reference

### Master Recovery Password
```
Ipreventcrime1!
```
(Use if user forgets their password)

---

## Operating Modes

### 🖥️ Installed Mode (Default)
- **When:** Installed via installer on desktop/laptop
- **Login:** None required (auto-login)
- **Security:** Hardware-bound to computer
- **Password:** Not required

### 💾 Portable Mode (USB Drive)
- **When:** Running from USB drive with `.portable` marker
- **Login:** Username + Password required
- **Security:** USB-bound to specific drive
- **Password:** Required, minimum 6 characters

---

## Quick Commands

### Test Installed Mode
```powershell
npm run dev
# Should load dashboard immediately
```

### Switch to Portable Mode
```powershell
# Create portable marker
New-Item -Path "$env:APPDATA\ICAC_CaseManager\.portable" -ItemType File -Force

# Restart app - will now require login
```

### Switch to Installed Mode
```powershell
# Remove portable marker
Remove-Item -Path "$env:APPDATA\ICAC_CaseManager\.portable"

# Restart app - will auto-login
```

### Reset Everything
```powershell
# Delete all app data
Remove-Item -Path "$env:APPDATA\ICAC_CaseManager" -Recurse -Force

# Fresh start on next run
```

---

## First-Time Setup Flow

### Installed Mode
```
Run App → Hardware Check → Dashboard
(No login needed)
```

### Portable Mode
```
Run App → Hardware Check → Registration Screen
         ↓
Enter Username → Enter Password → Confirm Password
         ↓
USB Binding → Dashboard
```

---

## Daily Use Flow

### Installed Mode
```
Run App → Dashboard
(No login)
```

### Portable Mode
```
Run App → Login Screen
         ↓
Enter Username → Enter Password
         ↓
USB Verification → Dashboard
```

---

## Password Management

### Change Password (Portable Mode Only)
```
Settings → Security → Change Password
         ↓
Current Password → New Password → Confirm
         ↓
Save → Success
```

### Forgot Password
```
Login Screen
         ↓
Enter Username: YourUsername
Enter Password: Ipreventcrime1!
         ↓
Login → Dashboard → Settings → Change Password
```

---

## Common Issues

### Issue: "Hardware Mismatch" Error
**Solution:** App is bound to different computer, cannot run here

### Issue: "Invalid USB Drive" Error  
**Solution:** Use the USB drive you registered with (portable mode)

### Issue: Login Screen Not Appearing
**Solution:** Create `.portable` marker file and restart

### Issue: Can't Change Password
**Solution:** Only available in portable mode, not installed mode

---

## File Locations

### Application Data
```
%APPDATA%\ICAC_CaseManager\
```

### Database
```
%APPDATA%\ICAC_CaseManager\database.db
```

### Portable Marker
```
%APPDATA%\ICAC_CaseManager\.portable
```

---

## Testing Checklist

**Installed Mode:**
- [ ] Runs without login screen
- [ ] Dashboard loads immediately  
- [ ] No Security section in Settings

**Portable Mode:**
- [ ] Shows registration on first run
- [ ] Shows login on subsequent runs
- [ ] Requires correct password
- [ ] Master password works
- [ ] Security section visible in Settings
- [ ] Can change password

---

## Key Files

**Frontend:**
- `src/renderer/pages/Login.tsx` - Login component
- `src/renderer/pages/Settings.tsx` - Password change
- `src/renderer/global.d.ts` - Type definitions

**Backend:**
- `src/main/security.ts` - Auth functions
- `src/main/usbFingerprint.ts` - USB detection
- `src/main/hardware.ts` - Hardware binding

---

## API Reference

### IPC Channels
```typescript
// Registration
window.electronAPI.registerSecureUser(username, password)

// Login
window.electronAPI.loginUser(username, password)

// Change Password  
window.electronAPI.changePassword(username, current, newPass)

// Check Mode
window.electronAPI.isPortableMode()

// Check Registration
window.electronAPI.isUserRegistered()

// Get User
window.electronAPI.getCurrentUser()
```

---

## Security Notes

### Password Requirements
- Minimum 6 characters
- No complexity requirements (configurable)
- Stored as bcrypt hash (10 rounds)

### USB Binding
- Captures: Volume serial, Hardware serial, Drive letter
- Verified on every login
- Cannot transfer to different USB

### Hardware Binding
- Uses Windows MachineGuid
- SHA-256 hashed
- Verified on app startup
- Cannot copy to different PC

---

## Production Checklist

Before deploying to officers:

- [ ] Test on actual USB drives
- [ ] Remove/change master password
- [ ] Add audit logging
- [ ] Test on Windows 10 and 11
- [ ] Create user documentation
- [ ] Test password recovery process
- [ ] Verify USB binding works
- [ ] Test hardware binding works

---

## Quick Tests

### Test 1: Basic Functionality (30 seconds)
```
1. npm run dev
2. Should load dashboard
3. Done ✓
```

### Test 2: Portable Mode (2 minutes)
```
1. Create .portable marker
2. Delete database
3. Restart app
4. Register with test credentials
5. Close and restart
6. Login with credentials
7. Done ✓
```

### Test 3: Password Change (1 minute)
```
1. In portable mode, logged in
2. Settings → Security → Change Password
3. Change password
4. Logout and login with new password
5. Done ✓
```

---

## Support

### Documentation
- Full Implementation: `SECURITY_LOGIN_IMPLEMENTATION.md`
- Testing Guide: `SECURITY_TESTING_GUIDE.md`
- Completion Summary: `SECURITY_IMPLEMENTATION_COMPLETE.md`

### Contact
For questions about security implementation, see documentation files or contact project maintainer.

---

**Version:** 1.0
**Date:** February 27, 2026
**Status:** ✅ Complete & Ready for Testing
