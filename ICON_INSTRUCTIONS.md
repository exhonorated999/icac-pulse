# Application Icon Instructions

## Current Status
The application is configured to use `build/icon.ico` for:
- Desktop shortcut icon
- Taskbar icon
- Window icon
- Installer icon
- Uninstaller icon

## Icon File Location
```
H:\Workspace\icac_case_manager\build\icon.ico
```

## If You See a Placeholder Icon

The icon might be a default Windows application icon. To replace it with a branded ICAC P.U.L.S.E. icon:

### Option 1: Replace the Existing Icon File

1. Create or obtain a proper icon file (.ico format)
2. Replace the file at:
   ```
   H:\Workspace\icac_case_manager\build\icon.ico
   ```
3. Rebuild the installer

### Option 2: Use an Icon Generator

If you have a logo image (PNG, JPG, etc.):

1. **Online Tool:**
   - Go to: https://www.icoconverter.com/
   - Upload your logo image
   - Download as .ico file
   - Replace `build/icon.ico`

2. **Requirements:**
   - Image should be square (e.g., 512x512, 256x256)
   - Should work on dark and light backgrounds
   - Common sizes: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256

### Option 3: Create Icon from Scratch

Use a tool like:
- **GIMP** (free) - Export as .ico
- **Photoshop** - Save for Web as .ico
- **Inkscape** (free vector graphics)

### Icon Design Suggestions

For ICAC P.U.L.S.E., consider:
- **Badge/Shield shape** - Represents law enforcement
- **Blue color scheme** - Professional, trustworthy
- **Subtle tech element** - Circuit lines, digital elements
- **P.U.L.S.E. text** or just **P** monogram
- **Star or badge** center element

### After Replacing the Icon

1. **Rebuild the installer:**
   ```
   cd /d H:\Workspace\icac_case_manager
   npm run package
   ```

2. **The new icon will be in:**
   - Desktop shortcut after installation
   - Taskbar when running
   - Start menu shortcut
   - Programs list

### Quick Test (Development Mode)

To see if the icon works in dev mode:
1. Replace `build/icon.ico`
2. Run: `npm run dev`
3. Check the window icon in taskbar
4. If it still shows placeholder, restart dev mode

## Current Configuration

**electron-builder.yml:**
```yaml
win:
  icon: build/icon.ico
nsis:
  installerIcon: build/icon.ico
  uninstallerIcon: build/icon.ico
```

**src/main/index.ts:**
```typescript
icon: path.join(__dirname, '../../build/icon.ico')
```

## Troubleshooting

### Icon Not Updating After Rebuild
1. Clear Windows icon cache:
   ```
   del %localappdata%\IconCache.db /a
   shutdown /r /f /t 00
   ```
2. Or just restart your computer

### Icon Shows in Dev But Not After Install
- Make sure `build/icon.ico` exists
- Rebuild with `npm run package`
- Reinstall the application

### Multiple Icon Sizes
.ico files can contain multiple sizes. Recommended:
- 16x16 (small icons)
- 32x32 (taskbar)
- 48x48 (desktop shortcut)
- 256x256 (high-DPI displays)

## Notes

- The icon file is **not** included in the repository by default
- Each developer/organization should use their own branded icon
- The placeholder icon is likely the default Electron icon
- Changing the icon does NOT affect the database or any data

---

**To fix the icon issue:**
1. Replace `H:\Workspace\icac_case_manager\build\icon.ico` with your branded icon
2. Run `BUILD-NOW.bat` to create new installer
3. Install the new version
4. Desktop shortcut will have the new icon
