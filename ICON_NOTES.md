# Application Icon for Production Build

## Current Status
The beta build (v1.0.0) uses the default Electron icon as a placeholder.

## Future Commercial Build Icon

### Icon Design
A professional desktop icon has been provided featuring:
- **P.U.L.S.E** text in cyan (#00D4FF)
- **Heartbeat line** graphic in orange/gold running through the text
- **Dark space background** with stars
- **Rounded corners** for modern aesthetic
- Matches the application's Neon Midnight cyberpunk theme

### File Requirements for Windows

To use the icon in future builds, you'll need to:

1. **Convert to .ico format** with multiple sizes:
   - 256x256 (primary)
   - 128x128
   - 64x64
   - 48x48
   - 32x32
   - 16x16

2. **Save location**: 
   ```
   icac_case_manager/build/icon.ico
   ```

3. **Update electron-builder.yml**:
   ```yaml
   win:
     icon: build/icon.ico  # Uncomment this line
   ```

### Conversion Tools

**Online Tools:**
- [ICO Converter](https://icoconvert.com/)
- [ConvertICO](https://convertico.com/)

**Professional Tools:**
- Adobe Photoshop (with ICO plugin)
- GIMP (with ICO export)
- IcoFX (Windows icon editor)

### Installation Steps for Next Build

1. Create the `build/` directory:
   ```powershell
   mkdir build
   ```

2. Place the converted `icon.ico` file in `build/icon.ico`

3. Uncomment the icon line in `electron-builder.yml`:
   ```yaml
   win:
     icon: build/icon.ico
   ```

4. Rebuild the installer:
   ```powershell
   npm run package
   ```

### Notes

- The icon will appear on:
  - Desktop shortcut
  - Start Menu shortcut
  - Application window title bar
  - Task bar when running
  - File properties

- Windows requires .ico format (not .png or .jpg)
- Higher resolution sizes improve display on high-DPI screens
- The installer size won't change significantly (icons are small)

## Beta Build Notice

The current beta build uses the default Electron icon. This is acceptable for testing but should be replaced with the professional icon before commercial release.
