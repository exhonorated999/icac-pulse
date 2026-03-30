# Security Features - Deployment Guide

## Pre-Deployment Checklist

Before building and distributing ICAC P.U.L.S.E. with security features, complete these steps:

---

## 1. Security Hardening

### Remove/Change Master Password

**Current Status:** Hardcoded master password `Ipreventcrime1!` exists for testing

**Production Options:**

**Option A: Remove Master Password (Recommended)**
```typescript
// File: src/main/security.ts
// Line ~115: Remove this block

// DELETE THIS ENTIRE SECTION:
if (password === MASTER_PASSWORD) {
  console.log('Master recovery password accepted');
  passwordValid = true;
} else {
  passwordValid = await bcrypt.compare(password, user.password_hash);
}

// REPLACE WITH:
passwordValid = await bcrypt.compare(password, user.password_hash);
```

**Option B: Admin-Only Recovery System**
Create a separate admin tool that:
1. Requires physical access to database
2. Allows password reset via secure process
3. Logs all recovery attempts
4. Requires two-factor authentication

**Option C: Department-Specific Master Password**
```typescript
// Use environment variable or encrypted config
const MASTER_PASSWORD = process.env.DEPARTMENT_MASTER_PASSWORD;
// Each department gets unique master password
// Stored in secure encrypted config file
```

### Remove Debug Logging

Search for and remove console.log statements that expose sensitive data:

```typescript
// Remove these from security.ts and other files:
console.log('Password hashed'); // OK - no data exposed
console.log('Password:', password); // REMOVE - exposes password
console.log('USB Fingerprint:', usbFingerprint); // REMOVE - sensitive
```

**Find all debug logs:**
```powershell
# Search for console.log in security-related files
Get-ChildItem -Path src -Recurse -Filter "*.ts" | 
  Select-String -Pattern "console.log.*password" -CaseSensitive
```

---

## 2. Build Configuration

### Portable Mode Setup

Create portable build:

```powershell
# Build the application
npm run build
npm run dist

# After build, create USB structure:
USB_Drive\
├── ICAC_PULSE.exe
├── resources\
├── .portable          # Marker file for portable mode
└── README.txt         # Instructions for officers
```

**Create .portable marker:**
```powershell
# After copying to USB, create marker
New-Item -Path "E:\.portable" -ItemType File -Force
# (Replace E: with actual USB drive letter)
```

### Installed Mode Setup

Use existing installer:

```powershell
npm run build
npm run dist
# Creates: dist\ICAC P.U.L.S.E. Setup.exe
```

**Installer will:**
- Install to `C:\Program Files\ICAC PULSE\`
- Create app data folder
- No `.portable` marker (installed mode)
- Auto-login without password

---

## 3. Documentation for Officers

### Create User Manual

**For Portable USB Version:**

```markdown
# ICAC P.U.L.S.E. - Portable Edition User Guide

## First-Time Setup

1. **Insert USB Drive**
   - Use the provided USB drive
   - DO NOT copy to other USB drives

2. **Run Application**
   - Double-click `ICAC_PULSE.exe`
   - Registration screen will appear

3. **Create Account**
   - Enter your name as username
   - Create a secure password (minimum 6 characters)
   - Confirm your password
   - Click "Register & Continue"

4. **Important Notes**
   - Your password is bound to THIS USB drive
   - Keep this USB drive secure
   - Do not share your password
   - Do not copy the USB contents

## Daily Use

1. **Insert USB Drive**
   - Must be the same USB drive you registered with

2. **Run Application**
   - Double-click `ICAC_PULSE.exe`
   - Login screen will appear

3. **Login**
   - Enter your username
   - Enter your password
   - Click "Login"

## Forgot Password?

If you forget your password:

1. At login screen, enter your username
2. For password, enter: `Ipreventcrime1!`
3. You will be logged in
4. Immediately go to Settings → Security
5. Click "Change Password"
6. Set a new password you'll remember

**Important:** Contact your IT administrator if you need to reset your password.

## Change Password

To change your password:

1. Open Settings (gear icon in sidebar)
2. Find the "Security" section
3. Click "Change Password"
4. Enter your current password
5. Enter your new password
6. Confirm your new password
7. Click "Save New Password"

## Security Reminders

- ⚠️ Never remove the USB drive while the application is running
- ⚠️ Always safely eject the USB drive before removing
- ⚠️ Keep the USB drive in a secure location
- ⚠️ Do not share your password with anyone
- ⚠️ Do not copy the USB contents to another drive
- ⚠️ Report lost or stolen USB drives immediately

## Troubleshooting

### "Invalid USB Drive" Error
- You are using a different USB drive
- Use the original USB drive you registered with
- If lost, contact IT for new installation

### Can't Login
- Verify you're using the correct password
- Try the recovery password
- Contact IT if still unable to login

### Application Won't Start
- Check that USB drive is fully inserted
- Try a different USB port
- Restart your computer
- Contact IT if problem persists

## Support

For technical support, contact:
[Your IT Support Contact Information]
```

**For Installed Desktop Version:**

```markdown
# ICAC P.U.L.S.E. - Desktop Edition User Guide

## Installation

1. **Run Installer**
   - Double-click `ICAC P.U.L.S.E. Setup.exe`
   - Follow installation prompts
   - Click "Install"

2. **First Launch**
   - Application will start automatically after install
   - No login required
   - Dashboard will appear

## Daily Use

1. **Launch Application**
   - Double-click desktop icon, or
   - Find in Start Menu

2. **Automatic Login**
   - Application will load dashboard immediately
   - No password required

## Important Notes

- Application is bound to THIS computer
- Cannot be copied to other computers
- Cannot be moved to USB drive
- No password required (hardware-bound)

## Support

For technical support, contact:
[Your IT Support Contact Information]
```

---

## 4. Distribution Process

### For Portable USB Distribution

**Materials Needed:**
- USB drives (minimum 4GB, USB 3.0 recommended)
- ICAC P.U.L.S.E. portable build
- Printed user manual
- USB drive labels

**Process:**

1. **Format USB Drives**
   ```
   - Format as NTFS
   - Volume label: "ICAC_PULSE"
   - Quick format acceptable
   ```

2. **Copy Files to USB**
   ```
   - Copy entire built application folder
   - Add .portable marker file
   - Add README.txt with instructions
   ```

3. **Test Each USB**
   ```
   - Run app from USB on test machine
   - Complete registration
   - Verify login works
   - Close app
   - Safely eject USB
   - Test on different machine (should not work)
   ```

4. **Label and Package**
   ```
   - Apply label with officer name/ID
   - Include printed user manual
   - Package in protective case
   - Log serial number of USB and officer assigned
   ```

5. **Distribution Log**
   ```csv
   USB_Serial,Officer_Name,Badge_Number,Date_Issued,Date_Returned
   ABC123,John Smith,12345,2024-01-15,
   ```

### For Desktop Installation Distribution

**Distribution Methods:**

**Method 1: Network Share**
```
1. Place installer on network share
2. Notify officers to download and install
3. Provide installation instructions
4. Offer remote support if needed
```

**Method 2: Physical Media**
```
1. Burn installer to USB drive or DVD
2. Distribute to officers
3. Provide installation instructions
4. Collect media after installation
```

**Method 3: Remote Deployment**
```
1. Use SCCM or similar deployment tool
2. Push silent installation to computers
3. Verify installation on each machine
4. Test functionality remotely
```

---

## 5. Post-Deployment Support

### Common Issues and Solutions

#### Issue: Officer Forgot Password (Portable)
**Solution:**
1. Verify officer identity
2. Instruct to use recovery password
3. Require immediate password change
4. Log recovery access

#### Issue: USB Drive Lost/Stolen (Portable)
**Solution:**
1. Issue new USB drive
2. New registration required
3. Manual case data transfer if needed
4. Report in security log
5. Old USB cannot access new installation

#### Issue: Computer Replaced (Desktop)
**Solution:**
1. Uninstall from old computer
2. Install on new computer
3. Manual case data transfer
4. New hardware binding automatic

#### Issue: Application Won't Start
**Solutions:**
- **Portable:** Wrong USB drive, use original
- **Desktop:** Hardware mismatch, reinstall
- **Both:** Check system requirements, update Windows

### Support Escalation

**Level 1: User Documentation**
- Provide user manual
- Check troubleshooting section

**Level 2: IT Help Desk**
- Basic troubleshooting
- Recovery password assistance
- USB drive replacement

**Level 3: Developer Support**
- Complex issues
- Database recovery
- Application bugs

---

## 6. Security Audit Log

Maintain logs of:

### Installation Log
```
Date: 2024-01-15
Officer: Det. John Smith
Badge: 12345
Type: Portable USB
USB Serial: ABC123
Installer Version: 1.0.0
```

### Recovery Access Log
```
Date: 2024-02-20
Officer: Det. John Smith  
Badge: 12345
Action: Recovery password used
Reason: Forgot password
New password set: Yes
```

### Incident Log
```
Date: 2024-03-10
Officer: Det. Jane Doe
Badge: 67890
Issue: USB drive lost
Resolution: New USB issued
Old USB: Reported to security
Case data: Transferred manually
```

---

## 7. Version Updates

### Updating Portable USB
```
1. Officer backs up case data
2. IT creates new USB with updated version
3. Manual data migration
4. Officer re-registers
5. Test thoroughly
6. Retire old USB
```

### Updating Desktop Installation
```
1. Download new installer
2. Backup case data (automatic if implemented)
3. Uninstall old version
4. Install new version
5. Hardware re-binding automatic
6. Verify data migrated
```

---

## 8. Compliance Checklist

Before deployment:

- [ ] Master password removed or secured
- [ ] Debug logging removed
- [ ] User documentation created
- [ ] Testing completed on USB drives
- [ ] Testing completed on various computers
- [ ] Distribution process documented
- [ ] Support procedures established
- [ ] Audit logging implemented
- [ ] Backup procedures documented
- [ ] Security policy reviewed
- [ ] Legal review completed
- [ ] Data handling procedures documented

---

## 9. Training Requirements

### For Officers

**Initial Training (2 hours):**
- Application overview
- Security features explanation
- USB/hardware binding concept
- Password creation best practices
- Daily usage workflow
- Troubleshooting basics
- Data security importance

**Hands-On Practice:**
- First-time registration
- Daily login process
- Password change
- Basic case management
- File upload/export
- Recovery password usage

### For IT Support

**Technical Training (4 hours):**
- Application architecture
- Security features in depth
- USB fingerprint technology
- Hardware binding mechanism
- Database structure
- Installation procedures
- Troubleshooting advanced issues
- Data recovery procedures
- Audit logging

---

## 10. Emergency Procedures

### Lost USB Drive
```
1. Officer reports loss immediately
2. Log incident with date/time/location
3. Security risk assessment
4. Issue replacement USB
5. Data recovery from backups
6. Update distribution log
7. Monitor for unauthorized access attempts
```

### Compromised Password
```
1. Officer reports immediately
2. Use recovery password to login
3. Change password immediately
4. Review audit logs
5. Assess data exposure risk
6. Update security policy if needed
```

### Application Corruption
```
1. Verify issue (won't start, errors, crashes)
2. Backup case data immediately
3. Uninstall application
4. Reinstall from clean source
5. Restore case data
6. Verify functionality
7. Log incident
```

---

## Summary

Deployment of ICAC P.U.L.S.E. with security features requires:

✅ **Pre-Deployment:**
- Remove/secure master password
- Clean up debug logging
- Test thoroughly

✅ **Distribution:**
- Proper USB drive preparation
- Tested installation media
- Clear documentation

✅ **Support:**
- Trained support staff
- Clear escalation procedures
- Documented troubleshooting

✅ **Ongoing:**
- Audit logging
- Security monitoring
- Version update procedures

Follow this guide to ensure secure, reliable deployment of ICAC P.U.L.S.E. to law enforcement officers.

---

**Document Version:** 1.0
**Last Updated:** February 27, 2026
**Next Review:** Before production deployment
