# ESP Waiting Icon Update

## Changes Made

Updated the Dashboard to display a custom icon for the "Waiting on E.S.P." status card instead of the generic 📊 emoji.

### Files Modified

1. **src/renderer/pages/Dashboard.tsx**
   - Added import for the waiting ESP icon
   - Updated the "Waiting on E.S.P." card to display the image
   - Image is displayed at 48x48px size

### Code Changes

```typescript
// Added import at top of file
import waitingEspIcon from '../assets/waiting-esp-icon.png';

// Updated the icon display in the card
<div className="w-12 h-12 flex items-center justify-center">
  <img 
    src={waitingEspIcon} 
    alt="Waiting on ESP" 
    className="w-full h-full object-contain"
  />
</div>
```

## Required Action

**You need to save your icon image:**

1. Take the clock/timer icon image you provided
2. Save it as: `waiting-esp-icon.png`
3. Place it in: `C:\Users\Justi\Workspace\icac_case_manager\src\renderer\assets\waiting-esp-icon.png`

### Recommended Image Specifications
- **Format:** PNG with transparency
- **Size:** 48x48px (or similar square dimensions)
- **Colors:** Yellow/gold tones to match the card's theme
- **Background:** Transparent

## Testing

After placing the image file:

1. Run the dev server:
   ```bash
   npm run dev
   ```

2. Check the Dashboard
3. The "Waiting on E.S.P." card should now display your custom clock/timer icon

## Visual Result

The icon will appear in the top-right corner of the "Waiting on E.S.P." card, replacing the 📊 emoji. The card maintains its yellow gradient theme with the custom icon providing a more professional, thematic appearance.

## Fallback

If the image fails to load for any reason, the browser will display the alt text "Waiting on ESP". Make sure the file path and name match exactly:
- File must be named: `waiting-esp-icon.png` (all lowercase, hyphens, .png extension)
- Must be in: `src/renderer/assets/` directory
