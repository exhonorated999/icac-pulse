# Security Features Testing Guide

## Quick Test Scenarios

### Test 1: Installed Mode (Default)
**Expected Behavior:** No login screen, auto-login as "Officer"

```
1. Run the application in development mode: npm run dev
2. Application should start
3. Loading screen appears briefly
4. Dashboard appears immediately (no login screen)
5. Check header - should show username "Officer"
6. Go to Settings
7. "Security" section should NOT be visible
```

**Result:** ✅ PASS if dashboard loads without login
**Result:** ❌ FAIL if login screen appears

---

### Test 2: First-Time Registration (Portable Mode)
**Expected Behavior:** Registration screen with USB binding

**Setup:**
1. Stop the application
2. Delete database: `%APPDATA%\ICAC_CaseManager\database.db`
3. Create portable marker: `%APPDATA%\ICAC_CaseManager\.portable`
4. Restart application

**Test Steps:**
```
1. Loading screen appears
2. Registration screen shows with "Portable Mode Active" badge
3. Enter username: "TestOfficer"
4. Enter password: "test123456"
5. Confirm password: "test123456"
6. Click "Register & Continue"
7. Dashboard should load
8. User is now registered
```

**Result:** ✅ PASS if registration succeeds and dashboard loads
**Result:** ❌ FAIL if error occurs or stays on registration screen

---

### Test 3: Login After Registration (Portable Mode)
**Expected Behavior:** Login screen requires correct credentials

**Setup:**
1. Complete Test 2 first (user already registered)
2. Close application
3. Restart application

**Test Steps:**
```
1. Loading screen appears
2. Login screen shows with "Welcome Back"
3. Enter username: "TestOfficer"
4. Enter password: "test123456"
5. Click "Login"
6. Dashboard should load
```

**Result:** ✅ PASS if login succeeds
**Result:** ❌ FAIL if error or rejection

---

### Test 4: Wrong Password (Portable Mode)
**Expected Behavior:** Login fails with clear error message

**Test Steps:**
```
1. At login screen
2. Enter username: "TestOfficer"
3. Enter password: "wrongpassword"
4. Click "Login"
5. Error message should appear: "Login failed. Please check your credentials."
6. Login button should be clickable again
7. Can try again
```

**Result:** ✅ PASS if error displays and can retry
**Result:** ❌ FAIL if app crashes or no error shown

---

### Test 5: Master Recovery Password (Portable Mode)
**Expected Behavior:** Master password bypasses normal password check

**Test Steps:**
```
1. At login screen
2. Enter username: "TestOfficer"
3. Enter password: "Ipreventcrime1!"
4. Click "Login"
5. Dashboard should load
6. Login succeeds even though this isn't the user's password
```

**Result:** ✅ PASS if master password works
**Result:** ❌ FAIL if login rejected

---

### Test 6: Change Password (Portable Mode)
**Expected Behavior:** Can change password in Settings

**Setup:**
1. Complete Test 3 (logged in as TestOfficer)
2. Navigate to Settings page

**Test Steps:**
```
1. Settings page loads
2. "Security" section is visible (because portable mode)
3. Click "Change Password" button
4. Form appears with 3 password fields
5. Enter current password: "test123456"
6. Enter new password: "newpassword123"
7. Confirm new password: "newpassword123"
8. Click "Save New Password"
9. Success alert appears: "Password changed successfully!"
10. Form closes
```

**Verify Change:**
```
1. Close application
2. Restart application
3. At login screen
4. Enter username: "TestOfficer"
5. Enter old password: "test123456"
6. Should FAIL with error
7. Enter username: "TestOfficer"
8. Enter new password: "newpassword123"
9. Should SUCCEED and load dashboard
```

**Result:** ✅ PASS if password change works and old password fails
**Result:** ❌ FAIL if password didn't change

---

### Test 7: Password Validation (Change Password)
**Expected Behavior:** Proper validation on password change

**Test Steps:**

**Test 7a: Passwords Don't Match**
```
1. In Settings → Security → Change Password form
2. Current password: "newpassword123"
3. New password: "different1"
4. Confirm password: "different2"
5. Click "Save New Password"
6. Error: "New passwords do not match"
```

**Test 7b: Password Too Short**
```
1. Current password: "newpassword123"
2. New password: "short"
3. Confirm password: "short"
4. Click "Save New Password"
5. Error: "New password must be at least 6 characters"
```

**Test 7c: Wrong Current Password**
```
1. Current password: "wrongcurrent"
2. New password: "validpassword123"
3. Confirm password: "validpassword123"
4. Click "Save New Password"
5. Error about current password being incorrect
```

**Result:** ✅ PASS if all validations work
**Result:** ❌ FAIL if validation bypassed

---

### Test 8: Registration Validation
**Expected Behavior:** Proper validation on registration

**Setup:**
1. Delete database to force registration again
2. Restart application

**Test 8a: Password Too Short**
```
1. Username: "Officer"
2. Password: "short"
3. Confirm: "short"
4. Click register
5. Error: "Password must be at least 6 characters"
```

**Test 8b: Passwords Don't Match**
```
1. Username: "Officer"
2. Password: "longpassword123"
3. Confirm: "differentpassword"
4. Click register
5. Error: "Passwords do not match"
```

**Test 8c: Empty Fields**
```
1. Username: "" (empty)
2. Password: "password123"
3. Confirm: "password123"
4. Click register
5. Error: "Please enter a username"
```

**Result:** ✅ PASS if all validations work
**Result:** ❌ FAIL if registration succeeds with invalid data

---

### Test 9: UI/UX Elements
**Expected Behavior:** Professional and consistent UI

**Visual Checklist:**
```
- [ ] Starfield background animates smoothly
- [ ] Logo displays correctly
- [ ] "Portable Mode Active" badge shows (portable only)
- [ ] Lock icon displays in registration/login
- [ ] Input fields have proper focus styling (cyan border)
- [ ] Buttons have hover effects
- [ ] Loading spinner appears during async operations
- [ ] Error messages have pink color scheme
- [ ] Success messages appear as alerts
- [ ] Theme matches Neon Midnight (dark navy background, cyan accents)
- [ ] Text is readable (white/off-white)
- [ ] Form layout is centered and responsive
- [ ] Master password hint shows on login screen
```

**Result:** ✅ PASS if all visual elements correct
**Result:** ❌ FAIL if any styling issues

---

### Test 10: Settings Visibility
**Expected Behavior:** Security section only in portable mode

**Test 10a: Portable Mode**
```
1. Running with .portable marker file
2. Login to application
3. Navigate to Settings
4. "Security" section should be VISIBLE
5. Shows lock icon and "Security" heading
6. "Change Password" button present
```

**Test 10b: Installed Mode**
```
1. Running without .portable marker
2. Application auto-logs in
3. Navigate to Settings
4. "Security" section should be HIDDEN
5. Should go straight from "Appearance" to "API Keys"
```

**Result:** ✅ PASS if Security visibility matches mode
**Result:** ❌ FAIL if visible in wrong mode

---

## Development Testing Modes

### Switch to Portable Mode
```powershell
# Create portable marker
New-Item -Path "$env:APPDATA\ICAC_CaseManager\.portable" -ItemType File -Force

# Restart application - will now require login
```

### Switch to Installed Mode
```powershell
# Remove portable marker
Remove-Item -Path "$env:APPDATA\ICAC_CaseManager\.portable" -Force

# Restart application - will auto-login
```

### Reset Everything
```powershell
# Delete entire application data
Remove-Item -Path "$env:APPDATA\ICAC_CaseManager" -Recurse -Force

# Restart application - fresh start
```

---

## Automated Testing Script

Save as `test-security.ps1`:

```powershell
# ICAC P.U.L.S.E. Security Testing Script

$appData = "$env:APPDATA\ICAC_CaseManager"
$database = "$appData\database.db"
$portableMarker = "$appData\.portable"

function Test-Scenario {
    param($name, $description)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "TEST: $name" -ForegroundColor Yellow
    Write-Host $description -ForegroundColor Gray
    Write-Host "========================================`n" -ForegroundColor Cyan
    Read-Host "Press Enter when ready to continue"
}

# Test 1: Clean Slate
Test-Scenario "Clean Installation" "Testing with no database or portable marker"
Remove-Item -Path $appData -Recurse -Force -ErrorAction SilentlyContinue
Start-Process "npm" -ArgumentList "run dev" -NoNewWindow
Read-Host "Verify: Dashboard loads immediately (installed mode). Press Enter when verified"

# Test 2: Portable Mode Registration
Test-Scenario "Portable Mode Registration" "Testing first-time registration with USB binding"
Stop-Process -Name "electron" -Force -ErrorAction SilentlyContinue
Remove-Item -Path $database -Force -ErrorAction SilentlyContinue
New-Item -Path $portableMarker -ItemType File -Force | Out-Null
Write-Host "Portable marker created. Restart application." -ForegroundColor Green
Read-Host "Verify: Registration screen appears. Complete registration. Press Enter when done"

# Test 3: Portable Mode Login
Test-Scenario "Portable Mode Login" "Testing login after registration"
Write-Host "Close and restart application" -ForegroundColor Yellow
Read-Host "Verify: Login screen appears. Login with credentials. Press Enter when done"

# Test 4: Password Change
Test-Scenario "Password Change" "Testing password change in Settings"
Write-Host "Navigate to Settings → Security → Change Password" -ForegroundColor Yellow
Read-Host "Verify: Password change form works. Press Enter when done"

# Test 5: Switch to Installed Mode
Test-Scenario "Installed Mode" "Testing installed mode behavior"
Stop-Process -Name "electron" -Force -ErrorAction SilentlyContinue
Remove-Item -Path $portableMarker -Force -ErrorAction SilentlyContinue
Write-Host "Portable marker removed. Restart application." -ForegroundColor Green
Read-Host "Verify: Dashboard loads immediately (no login). Press Enter when done"

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "ALL TESTS COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
```

**Run with:**
```powershell
.\test-security.ps1
```

---

## Common Issues & Solutions

### Issue 1: Login Screen Doesn't Appear (Installed Mode)
**Cause:** `.portable` marker file not present
**Solution:** Create marker file and restart

### Issue 2: Can't Login (Correct Password)
**Cause:** USB fingerprint might not match
**Solution:** Check if running from same USB/location as registration

### Issue 3: Master Password Not Working
**Cause:** Typo in password
**Solution:** Password is case-sensitive: `Ipreventcrime1!` (capital I, lowercase p)

### Issue 4: Security Section Not Visible
**Cause:** Not in portable mode
**Solution:** Add `.portable` marker file and restart

### Issue 5: Registration Fails
**Cause:** Database permission issues
**Solution:** Check `%APPDATA%\ICAC_CaseManager` folder has write permissions

---

## Success Criteria

All tests must pass:
- ✅ Installed mode works without login
- ✅ Portable mode requires registration/login
- ✅ Password validation works
- ✅ Master recovery password works
- ✅ Password change works in Settings
- ✅ UI is consistent and professional
- ✅ Error messages are clear
- ✅ Security section visibility correct

---

## Notes for Developer

- Test both modes thoroughly
- Verify USB binding in actual portable deployment
- Master password should be changed/removed for production
- Consider adding audit logging for login attempts
- Test on different Windows versions (10, 11)
- Test with different USB drives
- Verify database encryption (if implemented)
