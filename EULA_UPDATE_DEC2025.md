# EULA Update - December 25, 2025

## Summary

Updated the End-User License Agreement (EULA) in the Settings menu to the new comprehensive version from Intellect LE, LLC with enhanced legal protections and clarity.

## Key Changes from Previous Version

### 1. Effective Date
- **Changed from**: November 26, 2025
- **Changed to**: December 25, 2025

### 2. License Designation
- **Added**: "PERPETUAL" license type
- Emphasizes the permanent nature of the license grant

### 3. Major Content Enhancements

#### Section 1: Grant of Perpetual License
✅ **New**: Explicit "perpetual" designation  
✅ **New**: Bullet point clarifying offline nature  
✅ **New**: "No internet connection required" statement

#### Section 3: Data Security (Significantly Expanded)
✅ **New**: Opening context - "Because ICAC Pulse is a local-install, offline tool..."  
✅ **New**: Section 3.1 - Includes "evidence" in data types  
✅ **New**: Section 3.3 - Detailed sub-bullets with specific precautions:
- Multi-factor authentication
- Full-disk encryption
- Physical and network security
- Hardware failure protection

✅ **New**: Section 3.4 - Professional Use (entirely new section)
- Specific to Law Enforcement professionals
- Chain of custody considerations
- Legal standards and privacy laws

#### Section 5: Limitation of Liability
✅ **New**: Explicit mention of "loss of investigative data"  
✅ **New**: Added statement about entire risk being with Licensee

#### Section 6: Termination
✅ **New**: Specific mention of "unauthorized distribution"  
✅ **New**: "in your possession" clause for destruction

### 4. Contact Information Update
- **Changed from**: support@intellectle.com
- **Changed to**: Justin@intellect-le.com

### 5. Visual Improvements
- Added separator lines (────────) for better section breaks
- Improved bullet point formatting (• and ○)
- Enhanced readability with better spacing
- More professional presentation

## File Modified

**`src/renderer/pages/Settings.tsx`**
- Updated `licenseText` constant (lines ~135-230)
- Updated contact email in About section

## Display in Application

**Location**: Settings → Legal Information → View License Agreement

**Features**:
- Expandable/collapsible section
- Monospace font for professional appearance
- Scrollable container (max-height: 24rem)
- Full text preserved with formatting

## New Legal Protections

### For Intellect LE, LLC
1. **Perpetual License Language**: Clarifies license is permanent but revocable
2. **Enhanced IP Protection**: Stronger anti-duplication language
3. **Data Security Disclaimer**: Clear statement of no responsibility
4. **Professional Use Context**: Specific to Law Enforcement use case
5. **Investigative Data Loss**: Explicitly disclaimed in liability section

### For End Users (Law Enforcement)
1. **Perpetual Access**: Guaranteed ongoing use
2. **Offline Assurance**: No internet/web dependencies stated
3. **Clear Responsibilities**: Detailed list of security precautions
4. **Professional Context**: Acknowledges LE-specific needs
5. **Risk Allocation**: Clear understanding of responsibilities

## Testing Checklist

After rebuilding (`npm run build && npm run dist`):

- [ ] Open application
- [ ] Navigate to Settings
- [ ] Locate "Legal Information" section
- [ ] Click "View License Agreement"
- [ ] **Verify effective date**: December 25, 2025
- [ ] **Verify Section 1**: Contains "perpetual" language
- [ ] **Verify Section 3.4**: Professional Use section exists
- [ ] **Verify contact email**: Justin@intellect-le.com
- [ ] **Verify formatting**: Readable with proper spacing
- [ ] **Verify scrolling**: Works for full content

## Compliance Notes

This EULA now:
- ✅ Meets software licensing best practices
- ✅ Provides comprehensive liability protection
- ✅ Addresses offline/local operation explicitly
- ✅ Includes Law Enforcement specific considerations
- ✅ Clear anti-duplication provisions
- ✅ Professional data security disclaimers
- ✅ Chain of custody awareness

## Distribution Impact

Both versions include the updated EULA:
- **Installer Version**: `ICAC P.U.L.S.E. Setup 1.0.0.exe`
- **Portable Version**: `ICAC P.U.L.S.E.-1.0.0-Portable.exe`

Users will see the new EULA when they:
1. View Settings → Legal Information
2. Accept license on first run (if acceptance dialog is implemented)

## Comparison Summary

| Section | Old EULA | New EULA |
|---------|----------|----------|
| **Effective Date** | Nov 26, 2025 | Dec 25, 2025 |
| **License Type** | Standard | **Perpetual** |
| **Offline Mention** | Implied | **Explicit** |
| **Professional Use** | None | **Section 3.4** |
| **Investigative Data** | Generic | **Specific** |
| **Contact Email** | support@intellectle.com | **Justin@intellect-le.com** |
| **Formatting** | Basic | **Enhanced** |

## Recommendations

1. **Archive Old Version**: Keep previous EULA version for records
2. **Notify Users**: Consider in-app notification about EULA update
3. **Documentation**: Include EULA in user manual
4. **Training Materials**: Update any training to reference new EULA
5. **Support Docs**: Update FAQs with new contact email

## Technical Implementation

The EULA is stored as a JavaScript template literal with:
- Preserved whitespace
- Line breaks maintained
- Special characters properly escaped
- Unicode separators for visual breaks

The Settings component renders it with:
```tsx
<pre className="text-text-muted text-sm whitespace-pre-wrap font-mono">
  {licenseText}
</pre>
```

This ensures all formatting is preserved exactly as written.
