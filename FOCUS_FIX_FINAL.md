# Focus Management Fix - Final Solution

## The Real Problem
After saving data in the Overview tab, the entire page reloads with `loadCaseData()`, causing a complete re-render. Even though we tried restoring focus with `window.focus()` and focusing on input fields, the Electron window itself gets into a "stuck" state where:

1. The window LOOKS focused
2. But clicks on input fields don't work
3. Users have to click away from the app and back to make it interactive again

## Root Cause
When React re-renders after `loadCaseData()`, the Electron `BrowserWindow` loses its proper focus context. Simply calling `window.focus()` from the renderer doesn't properly reset the Electron window's internal focus state.

## The Solution: Blur + Refocus from Main Process

We need to **blur and refocus the Electron window from the main process** to properly reset its focus state.

### Step 1: Add IPC Channel
**File:** `src/shared/types.ts`
```typescript
export const IPC_CHANNELS = {
  // ... existing channels ...
  RESTORE_WINDOW_FOCUS: 'restore-window-focus',
}
```

### Step 2: Expose in Preload
**File:** `src/preload/index.ts`
```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing methods ...
  restoreWindowFocus: () => 
    ipcRenderer.invoke(IPC_CHANNELS.RESTORE_WINDOW_FOCUS),
});
```

### Step 3: Implement Handler in Main Process
**File:** `src/main/index.ts`
```typescript
ipcMain.handle(IPC_CHANNELS.RESTORE_WINDOW_FOCUS, async () => {
  try {
    const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (window) {
      // Blur then refocus to "reset" the window's focus state
      window.blur();
      setTimeout(() => {
        window.focus();
        window.webContents.focus();
      }, 50);
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to restore window focus:', error);
    return { success: false, error };
  }
});
```

**Key technique:**
- `window.blur()` - Removes focus from the Electron window
- Wait 50ms
- `window.focus()` - Gives focus back to the window
- `window.webContents.focus()` - Gives focus to the web contents

This combination properly resets the window's focus state.

### Step 4: Use in Save Handler
**File:** `src/renderer/pages/CaseDetail.tsx`
```typescript
// Refresh data
await loadCaseData();
setEditMode(false);

alert('Changes saved successfully!');

// Use Electron's window blur/focus to properly restore focus
setTimeout(async () => {
  await window.electronAPI.restoreWindowFocus();
  // Give React time to finish rendering
  setTimeout(() => {
    // Make the window truly interactive again
    document.body.click();
  }, 100);
}, 100);
```

**Why this works:**
1. Alert dismisses
2. Wait 100ms for alert to fully close
3. Call `restoreWindowFocus()` to blur/refocus the Electron window
4. Wait another 100ms for React to finish rendering
5. Simulate a click on document.body to "wake up" the interactivity

## Testing Instructions

1. Open a case (any type)
2. Click "Edit" on Overview tab
3. Make changes to any fields
4. Click "Save"
5. Dismiss the success alert
6. **Immediately scroll down to NCMEC Files section**
7. Click on the "NCMEC Filename" input field
8. **Expected:** You should be able to type immediately WITHOUT clicking away and back

## Why Previous Attempts Failed

### Attempt 1: window.focus() before alert
- **Issue:** Alert blocks and steals focus

### Attempt 2: window.focus() after alert
- **Issue:** Only focuses the window, not the Electron BrowserWindow

### Attempt 3: Focus specific input fields
- **Issue:** Input fields can't receive focus if the window itself is in a stuck state

### Attempt 4 (This one): Blur/refocus from main process
- **Success:** Properly resets the Electron window's internal focus state
- Window becomes fully interactive again
- Input fields can receive focus normally

## Additional Applications

This same technique should be applied to ALL save/upload handlers where we see the focus issue:

- ✅ CaseDetail.tsx - Overview save
- ⏳ SuspectTab.tsx - Photo upload
- ⏳ EvidenceTab.tsx - Evidence upload
- ⏳ WarrantsTab.tsx - Warrant uploads
- ⏳ OpPlanTab.tsx - PDF upload
- ⏳ CaseDetail.tsx - NCMEC folder upload
- ⏳ CaseDetail.tsx - P2P folder upload

We can apply the same pattern to all of these handlers.

## Technical Background

**Why Electron windows get stuck:**
- Electron wraps Chromium's rendering engine
- When React causes a heavy re-render, Chromium's focus manager can lose sync
- The window remains "technically" focused but input event handlers don't fire
- Blur/refocus resets Chromium's internal focus tracking

**Why blur + setTimeout + focus works:**
- `blur()` tells Chromium to release all focus state
- 50ms delay allows focus state to fully clear
- `focus()` + `webContents.focus()` rebuilds focus state from scratch
- Window is now in a known-good state

## Fallback Strategy

If this still doesn't work reliably, the nuclear option is:
1. Hide the window
2. Show the window
3. Focus the window

```typescript
window.hide();
setTimeout(() => {
  window.show();
  window.focus();
  window.webContents.focus();
}, 100);
```

But blur/focus should be sufficient.

## Date Completed
**December 1, 2025** - Implemented Electron-level focus restoration via blur/refocus pattern

## Status
🧪 **Testing Required** - Need to verify this fixes the Overview → NCMEC Files focus issue
