# ICAC P.U.L.S.E. Logo - Usage Guide

## Component Import

```typescript
import { Logo } from './components/Logo';
```

## Basic Usage

### Small Size (Sidebar)
```tsx
<Logo size="small" showFullText={true} />
```
**Height:** 40px  
**Use Case:** Navigation sidebar, compact spaces  
**Shows:** "ICAC" + "P.U.L.S.E" + pulse line

### Medium Size (Modals, Settings)
```tsx
<Logo size="medium" showFullText={true} />
```
**Height:** 60px  
**Use Case:** Modal headers, settings page, dialog boxes  
**Shows:** "ICAC" + "P.U.L.S.E" + pulse line

### Large Size (Splash Screens)
```tsx
<Logo size="large" showFullText={true} />
```
**Height:** 100px  
**Use Case:** Loading screens, registration, about pages  
**Shows:** "ICAC" + "P.U.L.S.E" + pulse line

## Compact Mode

### Hide "ICAC" Label
```tsx
<Logo size="small" showFullText={false} />
```
**Use Case:** Very compact spaces where only main branding needed  
**Shows:** "P.U.L.S.E" + pulse line (no "ICAC" above)

## Props Reference

```typescript
interface LogoProps {
  size?: 'small' | 'medium' | 'large';     // Default: 'medium'
  showFullText?: boolean;                   // Default: true
}
```

## Visual Breakdown

```
┌─────────────────────────────────────┐
│  ICAC                     (showFullText = true)
│  P . U . L . S . E ─⚡─────●         │
│     └─ Pulse line with animated flow│
│                └─ Pulsing dot       │
└─────────────────────────────────────┘
```

### Elements:
1. **ICAC Text** - Small, above main text (optional)
2. **P.U.L.S.E Text** - Large, bold, with dots between letters
3. **Pulse Line** - Orange/yellow gradient, animated flow
4. **Pulsing Dot** - End indicator, opacity animation

## Color Values

### Text Color
```css
fill: #00D4FF  /* Accent Cyan */
```

### Pulse Line Gradient
```css
stop-color: #FFB800  /* Orange/Yellow */
stop-color: #FF6B00  /* Mid-Orange */
stop-color: #FFB800  /* Orange/Yellow */
```

### Glow Effect
```css
feGaussianBlur stdDeviation: 3
```

## Animation Timing

### Pulse Line Flow
```css
duration: 2s
timing: ease-in-out
repeat: infinite
```
**Effect:** Energy flows through the pulse line

### Dot Pulse
```css
duration: 1.5s
timing: ease-in-out
repeat: infinite
opacity: 1 → 0.3 → 1
```
**Effect:** Heartbeat-like pulsing

## Implementation Examples

### 1. Sidebar (Layout.tsx)
```tsx
<div className="p-4 border-b border-accent-cyan/20">
  <Logo size="small" showFullText={true} />
</div>
```

### 2. Loading Screen (App.tsx)
```tsx
<div className="text-center relative z-10">
  <div className="mb-8 animate-pulse-slow">
    <Logo size="large" showFullText={true} />
  </div>
  <div className="w-16 h-16 border-4 border-accent-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
  <p className="text-text-primary text-lg">Initializing secure system...</p>
</div>
```

### 3. Registration Screen (App.tsx)
```tsx
<div className="text-center mb-8">
  <div className="mb-6">
    <Logo size="medium" showFullText={true} />
  </div>
  <h1 className="text-2xl font-bold text-text-primary mb-2">Welcome, Officer</h1>
  <p className="text-text-muted">First-time setup: Register your username</p>
</div>
```

### 4. Error Screen (App.tsx)
```tsx
<div className="bg-panel p-8 rounded-lg shadow-2xl border border-accent-pink/30 max-w-md text-center">
  <div className="mb-6">
    <Logo size="medium" showFullText={true} />
  </div>
  <h1 className="text-2xl font-bold text-accent-pink mb-4">Hardware Mismatch</h1>
  {/* Error message */}
</div>
```

### 5. Settings About (Settings.tsx)
```tsx
<div className="flex justify-center my-6">
  <Logo size="medium" showFullText={true} />
</div>
<div className="space-y-2 text-sm">
  <div className="flex justify-between">
    <span className="text-text-muted">Application Name:</span>
    <span className="text-text-primary font-medium">ICAC P.U.L.S.E.</span>
  </div>
  {/* More info */}
</div>
```

## Styling Tips

### Center Alignment
```tsx
<div className="flex justify-center">
  <Logo size="medium" showFullText={true} />
</div>
```

### With Animation
```tsx
<div className="animate-pulse-slow">
  <Logo size="large" showFullText={true} />
</div>
```

### With Margin
```tsx
<div className="mb-8">
  <Logo size="medium" showFullText={true} />
</div>
```

### In Panel/Card
```tsx
<div className="bg-panel border border-accent-cyan/20 rounded-lg p-6">
  <Logo size="small" showFullText={true} />
</div>
```

## Accessibility

### Current Features:
- High contrast (cyan on dark)
- Scalable at any size (SVG)
- Not reliant on animation (shape is distinctive)
- Clear visual hierarchy

### Recommended Additions:
```tsx
<div role="img" aria-label="ICAC PULSE logo">
  <Logo size="medium" showFullText={true} />
</div>
```

## Performance

### Optimization Details:
- **Pure SVG** - No external images
- **CSS animations** - Hardware accelerated
- **Inline styles** - No external CSS files
- **Lightweight** - ~3KB total

### Browser Support:
✅ All modern browsers (Chrome, Edge, Firefox, Safari)
✅ Electron (Chromium-based)
✅ SVG animations supported
✅ CSS filter effects supported

## Common Patterns

### Loading State
```tsx
<div className="flex items-center justify-center h-screen bg-background">
  <div className="text-center">
    <div className="mb-8 animate-pulse-slow">
      <Logo size="large" showFullText={true} />
    </div>
    <p className="text-text-primary">Loading...</p>
  </div>
</div>
```

### Modal Header
```tsx
<div className="modal-header p-6 border-b border-accent-cyan/20">
  <div className="mb-4">
    <Logo size="medium" showFullText={true} />
  </div>
  <h2 className="text-xl font-bold text-text-primary">Modal Title</h2>
</div>
```

### About Section
```tsx
<div className="about-section">
  <div className="flex justify-center mb-6">
    <Logo size="medium" showFullText={true} />
  </div>
  <div className="info-grid">
    {/* Application info */}
  </div>
</div>
```

## Do's and Don'ts

### ✅ Do:
- Use appropriate size for context
- Center align for splash screens
- Left align in sidebars/navigation
- Maintain aspect ratio
- Use on dark backgrounds
- Apply consistent spacing

### ❌ Don't:
- Stretch or distort logo
- Change logo colors
- Add drop shadows (has built-in glow)
- Use on light backgrounds (designed for dark)
- Disable animations in production
- Overlap with other content

## Technical Notes

### SVG Structure
```svg
<svg viewBox="0 0 400 100">
  <text>ICAC</text>                    <!-- Top label -->
  <text>P.U.L.S.E</text>                <!-- Main text -->
  <defs>
    <filter id="glow">...</filter>      <!-- Glow effect -->
    <linearGradient id="pulse">...</linearGradient>  <!-- Pulse color -->
  </defs>
  <path class="pulse-line">...</path>   <!-- Animated line -->
  <circle class="pulse-dot">...</circle> <!-- Pulsing dot -->
</svg>
```

### CSS Classes
```css
.logo-svg {
  filter: drop-shadow(0 0 10px rgba(0, 212, 255, 0.3));
}

.pulse-line {
  animation: pulse-flow 2s ease-in-out infinite;
}

.pulse-dot {
  filter: drop-shadow(0 0 5px #FFB800);
  animation: dot-pulse 1.5s ease-in-out infinite;
}
```

## Testing Checklist

### Visual Tests:
- [ ] Logo displays at correct size
- [ ] Colors match brand guidelines (#00D4FF, #FFB800)
- [ ] Animations are smooth (no jank)
- [ ] Glow effects visible but subtle
- [ ] Text is crisp and readable
- [ ] Aspect ratio maintained
- [ ] No rendering artifacts

### Functional Tests:
- [ ] Size prop works (small, medium, large)
- [ ] showFullText prop works (true/false)
- [ ] Animations run continuously
- [ ] No console errors
- [ ] No performance issues
- [ ] Works in all contexts (sidebar, modals, etc.)

### Cross-Platform Tests:
- [ ] Windows 10 - Displays correctly
- [ ] Windows 11 - Displays correctly
- [ ] Electron app - Renders properly
- [ ] Dev mode - Hot reload works
- [ ] Production build - Included in bundle

## Troubleshooting

### Logo Not Displaying
```typescript
// Check import path
import { Logo } from '../components/Logo';  // Adjust path as needed
```

### Animations Not Working
```typescript
// Ensure styles are included in component
// Logo component has inline <style> tag
```

### Size Issues
```typescript
// Ensure parent container doesn't constrain height
<div style={{ minHeight: '100px' }}>
  <Logo size="large" showFullText={true} />
</div>
```

### Color Mismatch
```typescript
// Colors are hardcoded in component
// To change, edit Logo.tsx directly
fill="#00D4FF"  // Cyan
stroke="url(#pulseGradient)"  // Orange gradient
```

## Version History

### v1.0.0 (Current)
- Initial logo component
- Three size options
- Animated pulse line and dot
- Glow effects
- Full text toggle option

### Future Versions:
- v1.1.0 - Color customization props
- v1.2.0 - Animation speed control
- v1.3.0 - Static variant (no animations)
- v2.0.0 - Multiple logo styles

## Support

### Questions?
- Check this guide first
- Review component source: `src/renderer/components/Logo.tsx`
- Check implementation examples in `App.tsx` and `Layout.tsx`

### Need Help?
- Verify import path is correct
- Ensure component is in correct location
- Check for TypeScript errors
- Review browser console for errors

## Credits

**Design:** Based on ICAC P.U.L.S.E. branding  
**Implementation:** SVG + CSS animations  
**Version:** 1.0.0  
**Last Updated:** November 2024

---

**Remember:** The logo is the face of ICAC P.U.L.S.E. Use it consistently and proudly!
