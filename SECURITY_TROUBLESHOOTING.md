# Security Features - Troubleshooting Guide

## Common Error: "No handler registered for 'is-portable-mode'"

### Error Message
```
Error: Error invoking remote method 'is-portable-mode': Error: No handler registered for 'is-portable-mode'
```

### Cause
The IPC handlers for security features are not registered in the main process. This usually happens when:

1. **Development server wasn't restarted** after adding new code
2. **Electron main process didn't reload** properly
3. **Build cache issues** in development mode

### Solutions

#### Solution 1: Full Restart (Recommended)
```powershell
# 1. Kill all electron processes
taskkill /F /IM electron.exe

# 2. Clear node_modules cache (if needed)
Remove-Item -Path node_modules\.vite -Recurse -Force -ErrorAction SilentlyContinue

# 3. Start dev server fresh
npm run dev
```

#### Solution 2: Clean Build
```powershell
# 1. Stop dev server (Ctrl+C)

# 2. Clean build artifacts
Remove-Item -Path dist-electron -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path dist-renderer -Recurse -Force -ErrorAction SilentlyContinue

# 3. Rebuild
npm run build

# 4. Start dev server
npm run dev
```

#### Solution 3: Full Clean Reinstall
```powershell
# 1. Kill electron
taskkill /F /IM electron.exe

# 2. Clean everything
Remove-Item -Path node_modules -Recurse -Force
Remove-Item -Path dist-electron -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path dist-renderer -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path package-lock.json -Force -ErrorAction SilentlyContinue

# 3. Reinstall
npm install

# 4. Run dev
npm run dev
```

---

## Verification Steps

### Step 1: Verify IPC Handlers Are Registered

Check that the handlers exist in `src/main/index.ts`:

```typescript
// Should be in the registerIPCHandlers() function:
ipcMain.handle(IPC_CHANNELS.IS_PORTABLE_MODE, async () => {
  try {
    return isPortableMode();
  } catch (error) {
    console.error('Error checking portable mode:', error);
    return false;
  }
});

ipcMain.handle(IPC_CHANNELS.REGISTER_SECURE_USER, async (_event, username: string, password: string) => {
  try {
    const user = await registerUser(username, password);
    return user;
  } catch (error: any) {
    console.error('Registration error:', error);
    throw new Error(error.message || String(error));
  }
});
```

### Step 2: Verify Preload Exposes Methods

Check that methods are exposed in `src/preload/index.ts`:

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  isPortableMode: () =>
    ipcRenderer.invoke(IPC_CHANNELS.IS_PORTABLE_MODE),
  registerSecureUser: (username: string, password: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.REGISTER_SECURE_USER, username, password),
  // ... other methods
});
```

### Step 3: Verify IPC_CHANNELS Are Defined

Check `src/shared/types.ts`:

```typescript
export const IPC_CHANNELS = {
  IS_PORTABLE_MODE: 'is-portable-mode',
  REGISTER_SECURE_USER: 'register-secure-user',
  LOGIN_USER: 'login-user',
  CHANGE_PASSWORD: 'change-password',
  IS_USER_REGISTERED: 'is-user-registered',
  // ... other channels
} as const;
```

### Step 4: Verify registerIPCHandlers() Is Called

Check `src/main/index.ts` in `app.whenReady()`:

```typescript
app.whenReady().then(async () => {
  // ... other initialization

  // This line must be present:
  registerIPCHandlers();

  // ... create window
});
```

---

## Development Mode Issues

### Hot Reload Doesn't Work for Main Process

**Problem:** Changes to main process files don't trigger reload

**Solution:**
- Main process (src/main/) requires full restart
- Renderer (src/renderer/) hot-reloads automatically
- Preload (src/preload/) requires full restart

**Workflow:**
```
1. Make changes to renderer files → Save → Auto-reloads
2. Make changes to main/preload → Save → Manually restart dev server
```

### Cache Issues

**Problem:** Old code still running despite changes

**Solution:**
```powershell
# Clear Vite cache
Remove-Item -Path node_modules\.vite -Recurse -Force

# Clear Electron cache
Remove-Item -Path "$env:APPDATA\ICAC_CaseManager" -Recurse -Force

# Restart
npm run dev
```

---

## Testing IPC Handlers

### Console Test

Open Developer Tools (F12) and run:

```javascript
// Test if electronAPI exists
console.log('electronAPI:', window.electronAPI);

// Test if methods exist
console.log('isPortableMode:', typeof window.electronAPI.isPortableMode);
console.log('registerSecureUser:', typeof window.electronAPI.registerSecureUser);

// Test calling methods
window.electronAPI.isPortableMode().then(result => {
  console.log('Portable mode:', result);
}).catch(err => {
  console.error('Error:', err);
});
```

**Expected Output:**
```
electronAPI: { isPortableMode: ƒ, registerSecureUser: ƒ, ... }
isPortableMode: function
registerSecureUser: function
Portable mode: false  // or true
```

**Error Output (if handlers not registered):**
```
Error: Error invoking remote method 'is-portable-mode': Error: No handler registered for 'is-portable-mode'
```

---

## Build Issues

### TypeScript Compilation Errors

**Check for errors:**
```powershell
npm run build
```

**Common issues:**
- Missing type definitions
- Import path errors
- Missing dependencies

### Electron Builder Issues

**Test build:**
```powershell
npm run dist
```

**Common issues:**
- Missing icon files
- Invalid electron-builder config
- Missing dependencies in package.json

---

## Runtime Issues

### "Cannot read property 'invoke' of undefined"

**Problem:** `window.electronAPI` is undefined

**Cause:** Preload script not loaded or context isolation issue

**Solution:**
1. Verify preload path in BrowserWindow config
2. Check that contextIsolation is true
3. Verify contextBridge is working

### "Module not found" Errors

**Problem:** Import paths are broken

**Solution:**
```typescript
// Use relative paths for main process
import { something } from './module';

// Use alias paths for renderer
import { something } from '@/module';
```

---

## Security-Specific Issues

### "security.ts" Not Found

**Problem:** Security module missing or not imported

**Check imports in main/index.ts:**
```typescript
import { 
  initSecurityDb, 
  isUserRegistered, 
  registerUser, 
  loginUser, 
  changePassword, 
  getCurrentUser 
} from './security';

import { isPortableMode } from './usbFingerprint';
```

### "usbFingerprint.ts" Not Found

**Problem:** USB fingerprint module missing

**Check:**
```powershell
# Verify file exists
Test-Path src\main\usbFingerprint.ts

# If missing, create from template or restore from backup
```

---

## Database Issues

### "security_users table not found"

**Problem:** Security database not initialized

**Solution:**
```typescript
// In main/index.ts, verify this is called:
initSecurityDb();

// Check that security.ts has:
export function initSecurityDb(): void {
  const db = getDatabase();
  db.run(`
    CREATE TABLE IF NOT EXISTS security_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      usb_volume_serial TEXT NOT NULL,
      usb_hardware_serial TEXT NOT NULL,
      usb_drive_letter TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
```

**Manual Fix:**
```powershell
# Delete database to force recreation
Remove-Item -Path "$env:APPDATA\ICAC_CaseManager\database.db"

# Restart app - will recreate tables
```

---

## Emergency Recovery

### Cannot Start Application At All

**Full Reset:**
```powershell
# 1. Kill all processes
taskkill /F /IM electron.exe
taskkill /F /IM node.exe

# 2. Delete application data
Remove-Item -Path "$env:APPDATA\ICAC_CaseManager" -Recurse -Force

# 3. Delete build artifacts
Remove-Item -Path dist-electron -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path dist-renderer -Recurse -Force -ErrorAction SilentlyContinue

# 4. Reinstall dependencies
Remove-Item -Path node_modules -Recurse -Force
npm install

# 5. Start fresh
npm run dev
```

---

## Getting Help

### Before Reporting Issue

Collect this information:

1. **Error Message:**
   ```
   Copy full error from console
   ```

2. **Steps to Reproduce:**
   ```
   1. Start app
   2. Do X
   3. Error appears
   ```

3. **Environment:**
   ```
   - Windows version: (run 'systeminfo' to get)
   - Node version: (run 'node --version')
   - npm version: (run 'npm --version')
   - Development or production build?
   ```

4. **Console Output:**
   ```
   Copy both browser console and terminal output
   ```

5. **Recent Changes:**
   ```
   What files were modified before the error?
   ```

---

## Quick Reference

### Restart Dev Server
```powershell
taskkill /F /IM electron.exe
npm run dev
```

### Clear Cache
```powershell
Remove-Item -Path node_modules\.vite -Recurse -Force
Remove-Item -Path "$env:APPDATA\ICAC_CaseManager" -Recurse -Force
```

### Fresh Start
```powershell
taskkill /F /IM electron.exe
Remove-Item -Path node_modules -Recurse -Force
npm install
npm run dev
```

### Test in Console
```javascript
window.electronAPI.isPortableMode().then(console.log).catch(console.error);
```

---

**Remember:** After making changes to main process or preload files, ALWAYS fully restart the dev server. Hot reload only works for renderer files!
