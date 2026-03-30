# Case Type Icons Update - Create Case Page

## Overview

Updated the Create Case page with custom cyberpunk-themed icons for all four case types, replacing generic emojis with professionally designed SVG icons that match the application's neon aesthetic.

## New Icons Created

### 1. CyberTip Icon - Cyan (#00D4FF)
**Design Elements:**
- Shield/Badge outline (protection theme)
- Warning triangle with exclamation mark inside
- Data stream indicators (incoming reports)
- Represents NCMEC reporting system

**Visual Theme:** Alert/Protection/Reporting

### 2. P2P Icon - Purple (#7B68EE)
**Design Elements:**
- Multiple network nodes (peer connections)
- Interconnected lines between nodes
- Data packet indicators
- Represents distributed file sharing

**Visual Theme:** Network/Connection/Distributed

### 3. Chat Icon - Green (#39FFA0)
**Design Elements:**
- Overlapping chat bubbles
- Text lines inside main bubble
- Typing indicator dots (animated feel)
- Secondary bubble for conversation

**Visual Theme:** Communication/Conversation/Undercover

### 4. Other Case Icon - Yellow (#FFB800)
**Design Elements:**
- Folder with question mark
- Data nodes around the folder
- Connection lines suggesting flexibility
- Represents general/unknown case types

**Visual Theme:** Flexible/General/Unknown

## Color-Coded Interactions

Each case type now has its own color scheme that activates on hover:

| Case Type | Color | Hex Code | Usage |
|-----------|-------|----------|-------|
| CyberTip | Cyan | #00D4FF | Border, background, title |
| P2P | Purple | #7B68EE | Border, background, title |
| Chat | Green | #39FFA0 | Border, background, title |
| Other | Yellow | #FFB800 | Border, background, title |

## User Experience Improvements

### Visual Feedback on Hover:
1. **Icon scales up** (110% size)
2. **Border changes** to case type color
3. **Background tints** with case type color (5% opacity)
4. **Title changes** to case type color
5. **Arrow appears** on right side
6. **Description brightens** for better readability

### Transitions:
- Smooth 200ms transitions on all elements
- Scale transform on icons
- Color transitions on borders and text
- Opacity fade on arrow indicator

## Technical Implementation

### Files Modified

1. **src/renderer/components/DashboardIcons.tsx**
   - Added `CyberTipIcon` component
   - Added `P2PIcon` component
   - Added `ChatIcon` component
   - Added `OtherCaseIcon` component
   - Each with unique glow filter IDs

2. **src/renderer/pages/CreateCase.tsx**
   - Imported all four case type icons
   - Changed icon property from string to icon type
   - Added `getHoverClasses()` helper function
   - Added `getTitleHoverClass()` helper function
   - Updated card rendering with color-specific classes
   - Applied icons to each card type

### Icon Implementation Pattern

```tsx
// Icon Component
export const CaseTypeIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <filter id="glow-unique">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    {/* SVG paths with filter applied */}
  </svg>
);

// Usage in Cards
<div className="w-20 h-20 mb-4 group-hover:scale-110 transition-transform">
  {caseType.icon === 'cybertip' && <CyberTipIcon className="w-full h-full" />}
</div>
```

### Dynamic Color Classes

```tsx
const getHoverClasses = (color: string) => {
  const colorMap: Record<string, string> = {
    cyan: 'hover:border-[#00D4FF] hover:bg-[#00D4FF]/5 focus:ring-[#00D4FF]/50',
    purple: 'hover:border-[#7B68EE] hover:bg-[#7B68EE]/5 focus:ring-[#7B68EE]/50',
    green: 'hover:border-[#39FFA0] hover:bg-[#39FFA0]/5 focus:ring-[#39FFA0]/50',
    yellow: 'hover:border-[#FFB800] hover:bg-[#FFB800]/5 focus:ring-[#FFB800]/50'
  };
  return colorMap[color] || colorMap.cyan;
};
```

## Design Consistency

All icons follow the established pattern:
- ✅ 100x100 viewBox for consistency
- ✅ Stroke-based design (not filled shapes)
- ✅ 2-3px stroke widths
- ✅ Glow filters for neon effect
- ✅ Multiple detail elements
- ✅ Opacity variations for depth
- ✅ Theme-matching colors

## Before vs After

### Before:
- Generic emojis (🛡️, 🔗, 💬, 📋)
- All cards had cyan hover color
- Less distinctive visual identity
- Emojis don't match app theme

### After:
- Custom cyberpunk icons
- Color-coded by case type
- Strong visual identity for each type
- Professional, cohesive design
- Icons perfectly match neon theme

## Result

The Create Case page now presents a professional, visually appealing selection interface where each case type has its own distinct identity through color and iconography, while maintaining the overall cyberpunk aesthetic of ICAC P.U.L.S.E.

Users can now:
1. Quickly identify case types by icon and color
2. Enjoy enhanced visual feedback when hovering
3. Experience a more polished, professional interface
4. Better understand the purpose of each case type through symbolic icons
