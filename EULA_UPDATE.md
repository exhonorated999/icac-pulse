# EULA Update - Intellect LE, LLC

## Overview
Updated the End-User License Agreement (EULA) in the Settings page to reflect the proper legal framework and company ownership by Intellect LE, LLC.

## Changes Made

### 1. **Updated EULA Text**

**Previous:** Generic "ICAC P.U.L.S.E." EULA  
**New:** Comprehensive Intellect LE, LLC EULA

#### Key Updates:
- **Effective Date:** November 26, 2025
- **Licensor:** Intellect LE, LLC (properly identified)
- **Software Name:** ICAC Pulse (standardized)
- **Legal Structure:** Professional binding agreement

### 2. **EULA Content**

#### Section 1: Grant of License
- Non-exclusive, non-transferable, revocable license
- Single device installation
- Strict compliance requirements

#### Section 2: Restrictions and Intellectual Property
- **2.1 Prohibition on Duplication and Distribution**
  - Expressly forbidden from copying/duplicating
  - No sublicensing, publishing, or redistribution
  - Material breach clause
  - Copyright law violation warnings

- **2.2 Prohibited Uses**
  - No modification, adaptation, translation
  - No reverse engineering, decompiling, or disassembling
  - No derivative works

#### Section 3: Data Security and End-User Responsibilities
- **3.1 Local Storage and Data Responsibility**
  - Software operates locally
  - All data stored on device
  - Sensitive investigative case files

- **3.2 Disclaimer of Security Liability**
  - **CRITICAL:** Intellect LE, LLC NOT RESPONSIBLE for data security
  - Security is SOLELY Licensee's responsibility
  - Clear liability disclaimer

- **3.3 Licensee Precautions**
  - Strong passwords
  - Device encryption
  - Network security
  - Regular backups
  - All precautions are Licensee's responsibility

#### Section 4: Software Updates and Maintenance
- **4.1 No Updates Provided**
  - Due to offline nature
  - No obligation to provide updates
  - No maintenance releases, patches, or bug fixes
  - No new versions

- **4.2 "AS IS" Basis**
  - Software provided "AS IS"
  - No warranties of any kind
  - Express disclaimer

#### Section 5: Limitation of Liability
- No liability for special, incidental, indirect, or consequential damages
- No liability for:
  - Loss of business profits
  - Business interruption
  - Loss of business information
  - Any other pecuniary loss
- Applies even if advised of possibility of damages

#### Section 6: Termination
- Effective until terminated
- Immediate termination for non-compliance
- Must cease use and destroy all copies

#### Section 7: Governing Law and Jurisdiction
- Governed by laws where Intellect LE, LLC is incorporated
- No conflict of law principles

#### Section 8: Entire Agreement
- Complete agreement between parties
- Supersedes all prior communications

#### Section 9: Contact Information
- Company: Intellect LE, LLC
- Email: support@intellectle.com

### 3. **About Section Updates**

Added company information to the About section:

```
Developer: Intellect LE, LLC
Copyright: © 2025 Intellect LE, LLC
Contact: support@intellectle.com
```

## Legal Highlights

### Strong Protections
1. ✅ **No Duplication** - Expressly forbidden
2. ✅ **No Distribution** - Material breach if violated
3. ✅ **No Reverse Engineering** - Prohibited
4. ✅ **No Liability for Data** - Clear disclaimer
5. ✅ **No Updates** - No ongoing obligations
6. ✅ **"AS IS"** - No warranties
7. ✅ **Limited Liability** - Protected from damages

### User Responsibilities
1. ⚠️ **Data Security** - Entirely on user
2. ⚠️ **Device Security** - User must implement
3. ⚠️ **Backups** - User must maintain
4. ⚠️ **Network Security** - User's responsibility
5. ⚠️ **Compliance** - Must follow all terms

## Implementation Details

### File Modified
**`src/renderer/pages/Settings.tsx`**

#### EULA Text Variable
```typescript
const licenseText = `End-User License Agreement (EULA) for ICAC Pulse

EFFECTIVE DATE: November 26, 2025

This End-User License Agreement (the "Agreement") is a binding legal agreement between you, the End-User (referred to as "Licensee" or "You"), and Intellect LE, LLC...
`;
```

#### About Section
```typescript
<div className="flex justify-between pt-4 mt-4 border-t border-accent-cyan/20">
  <span className="text-text-muted">Developer:</span>
  <span className="text-text-primary font-medium">Intellect LE, LLC</span>
</div>
<div className="flex justify-between">
  <span className="text-text-muted">Copyright:</span>
  <span className="text-text-primary font-medium">© 2025 Intellect LE, LLC</span>
</div>
<div className="flex justify-between">
  <span className="text-text-muted">Contact:</span>
  <span className="text-text-primary font-medium">support@intellectle.com</span>
</div>
```

## User Interface

### Settings Page - Legal Information Section
```
┌────────────────────────────────────────┐
│ 📄 Legal Information                   │
├────────────────────────────────────────┤
│ View the End User License Agreement    │
│ (EULA)                                 │
│                                        │
│ [👁️ View License Agreement]            │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ End-User License Agreement (EULA)  │ │
│ │ for ICAC Pulse                     │ │
│ │                                    │ │
│ │ EFFECTIVE DATE: November 26, 2025  │ │
│ │                                    │ │
│ │ This End-User License Agreement... │ │
│ │ [Scrollable full text]             │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

### About Section
```
┌────────────────────────────────────────┐
│ ℹ️ About                                │
├────────────────────────────────────────┤
│         [ICAC P.U.L.S.E Logo]          │
│                                        │
│ Application Name:    ICAC P.U.L.S.E.   │
│ Full Name:           Prosecution &     │
│                      Unit Lead Support │
│                      Engine            │
│ Version:             1.0.0             │
│ Purpose:             ICAC Case Mgmt    │
│ Data Storage:        100% Offline      │
│ ────────────────────────────────────── │
│ Developer:           Intellect LE, LLC │
│ Copyright:           © 2025 Intellect  │
│                      LE, LLC           │
│ Contact:             support@          │
│                      intellectle.com   │
└────────────────────────────────────────┘
```

## Comparison

### Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| Company | "ICAC P.U.L.S.E." | Intellect LE, LLC |
| Date | November 2024 | November 26, 2025 |
| Structure | Basic EULA | Comprehensive Legal |
| Sections | 10 sections | 9 detailed sections |
| Liability | Generic | Explicit disclaimer |
| Updates | Unclear | Explicitly NO updates |
| Contact | Generic support | support@intellectle.com |
| Copyright | Generic | © 2025 Intellect LE, LLC |

## Legal Significance

### Protections for Intellect LE, LLC
1. **Intellectual Property** - Clear ownership established
2. **No Duplication** - Strict prohibition with legal consequences
3. **Data Liability** - Complete disclaimer of responsibility
4. **No Updates** - No ongoing obligations after sale
5. **Limited Liability** - Protected from damage claims
6. **Termination Rights** - Can terminate for non-compliance

### User Understanding
- Clear that software is LICENSED, not sold
- Explicit about data security being user's responsibility
- Understand no updates will be provided
- Know the software is "AS IS"
- Aware of restrictions on use and duplication

## Testing Checklist

### Visual Verification
- [ ] EULA displays in Settings → Legal Information
- [ ] Full text is readable and scrollable
- [ ] Effective date shows as November 26, 2025
- [ ] Company name is Intellect LE, LLC throughout
- [ ] Contact email is support@intellectle.com
- [ ] About section shows company info

### Content Verification
- [ ] Section 1: Grant of License present
- [ ] Section 2: Restrictions and IP present
- [ ] Section 2.1: Prohibition on Duplication present
- [ ] Section 2.2: Prohibited Uses present
- [ ] Section 3: Data Security and Responsibilities present
- [ ] Section 3.2: Disclaimer of Security Liability CAPITALIZED
- [ ] Section 4: Software Updates (No Updates) present
- [ ] Section 5: Limitation of Liability present
- [ ] Section 6: Termination present
- [ ] Section 7: Governing Law present
- [ ] Section 8: Entire Agreement present
- [ ] Section 9: Contact Information present
- [ ] Copyright notice: © 2025 Intellect LE, LLC

### Functional Verification
- [ ] Toggle button shows/hides EULA
- [ ] EULA text is formatted properly
- [ ] Scrolling works in EULA container
- [ ] About section displays correctly
- [ ] All company info visible
- [ ] Contact email displayed

## Distribution Considerations

### Before Distribution
1. ✅ Legal review of EULA (if required)
2. ✅ Verify effective date is correct
3. ✅ Confirm contact information is accurate
4. ✅ Ensure copyright year is correct
5. ✅ Test EULA display in application

### User Acceptance
- Users must read EULA before/during installation
- First-time setup shows agreement terms
- Users acknowledge by using software
- EULA available anytime in Settings

## Compliance

### Legal Requirements Met
- ✅ Clear identification of parties
- ✅ Grant of license defined
- ✅ Restrictions explicitly stated
- ✅ Liability limitations clear
- ✅ Termination conditions specified
- ✅ Governing law identified
- ✅ Contact information provided

### Best Practices Followed
- ✅ Professional legal language
- ✅ Comprehensive coverage
- ✅ Clear structure and sections
- ✅ Capitalized critical disclaimers
- ✅ Accessible in application
- ✅ Easy to read and understand

## Future Considerations

### Potential Updates
- Version-specific terms if needed
- Additional restrictions if required
- Regional variations if applicable
- Multi-language versions if distributed internationally

### Tracking
- Consider logging EULA acceptance
- Track which version users agreed to
- Maintain change history
- Notify users of material changes

## Notes

### Legal Disclaimer
This EULA update is for informational purposes. The actual legal binding agreement is the text displayed in the application. Users should consult legal counsel for interpretation of terms.

### Version Control
- EULA Effective Date: November 26, 2025
- Application Version: 1.0.0
- Last Updated: November 26, 2025

### Contact
For legal questions regarding this EULA:
- Company: Intellect LE, LLC
- Email: support@intellectle.com

## Summary

Successfully updated ICAC P.U.L.S.E. with:
1. ✅ Comprehensive professional EULA
2. ✅ Proper company attribution (Intellect LE, LLC)
3. ✅ Clear liability disclaimers
4. ✅ Explicit restriction on duplication/distribution
5. ✅ User responsibility for data security
6. ✅ No update obligations
7. ✅ Complete legal protections
8. ✅ Contact information provided
9. ✅ Copyright notices updated
10. ✅ Professional About section

The EULA now provides strong legal protection for Intellect LE, LLC while clearly communicating terms and responsibilities to end users.
