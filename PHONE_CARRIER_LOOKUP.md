# Phone Carrier Lookup Feature

## Overview
Integrated optional phone carrier lookup using Numverify API. Each officer creates their own free account and API key, avoiding costs for the developer and giving each user 250 free lookups per month.

## User Setup (One-Time)

### Step 1: Create Free Numverify Account
1. Visit https://numverify.com
2. Sign up for a free account
3. Verify your email
4. Log in to your dashboard

### Step 2: Get API Key
1. After login, you'll see your **API Access Key** on the dashboard
2. Copy the API key (looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

### Step 3: Configure in ICAC P.U.L.S.E.
1. Open ICAC P.U.L.S.E. application
2. Navigate to **Settings** (bottom of sidebar)
3. Scroll to **"API Keys & Optional Features"** section
4. Find **"Numverify Phone Carrier Lookup"**
5. **Toggle ON** the feature (switch on right side)
6. Paste your API key in the input field
7. Click **"Save"**
8. You'll see: "✓ API key configured" with masked key (••••••••••••1234)

**Important:** The lookup button will only appear in the app when BOTH:
- ✅ The toggle is enabled (ON)
- ✅ An API key is saved

## Using Carrier Lookup

### In CyberTip Cases - Adding Phone Identifiers

**When adding a new phone identifier:**

1. Click **Edit** in the CyberTip Overview
2. In the Identifiers section, select **"Phone"** from dropdown
3. Enter the phone number (e.g., `14158586273`)
   - Can include +, spaces, dashes, parentheses - they'll be cleaned automatically
   - Example formats: `+1-415-858-6273`, `(415) 858-6273`, `14158586273`
4. Click the **📱 Lookup** button (next to carrier field)
5. Wait for lookup (usually 1-2 seconds)
6. Carrier name auto-fills (e.g., "Verizon Wireless")
7. You can edit the carrier name if needed
8. Click **"Add"** to save the identifier

**Results Include:**
- Carrier name (Verizon, AT&T, T-Mobile, Sprint, etc.)
- Line type (mobile, landline, voip, etc.)
- Location (if available)

### Free Tier Limits
- **250 lookups per month** per API key
- Resets on the 1st of each month
- If you exceed limit, you'll see an error - just wait until next month or upgrade your Numverify plan

## Features

### Security
- API key stored in session memory (not in database)
- Key is masked in UI (only shows last 4 digits)
- "Remove" button to clear API key
- No case data sent to Numverify - only phone number

### Optional Feature
- Works completely without API key
- Officers can manually enter carrier if they prefer
- No impact on app functionality if not configured

### Error Handling
- "API key not configured" - User needs to add key in Settings
- "Invalid phone number" - Check number format
- "Lookup failed" - API issue or invalid number
- All errors shown via toast notifications

## Technical Details

### API Integration
- Uses Numverify RESTful API
- Endpoint: `http://apilayer.net/api/validate`
- Method: GET with query parameters
- Response format: JSON

### Network Requests
- Only triggered when user clicks "Lookup" button
- User-initiated, optional feature
- Only phone number transmitted (no case data)
- Similar to ARIN lookup for IP addresses

### Database Storage
- Phone identifiers stored with `provider` field
- Same schema as IP identifiers
- Carrier name stored as text in `cybertip_identifiers.provider`

## Settings UI

### API Keys Section (New)
Located between "Theme Toggle" and "License Agreement" in Settings:

**Visual Design:**
- Card with phone emoji icon 📱
- **Toggle Switch** on the right (Enable/Disable feature)
- Title: "Numverify Phone Carrier Lookup"
- Description of feature
- Setup instructions (only visible when toggle is ON)
- Input field for API key (masked when saved, only visible when toggle is ON)
- Save/Remove buttons (only visible when toggle is ON)
- Warning: "Your personal API key is stored securely..."

**States:**
- **Toggle OFF:** Only shows title, description, and toggle switch
- **Toggle ON + Not Configured:** Shows setup instructions + input field
- **Toggle ON + Configured:** Shows masked key + Remove button

**Button Visibility in App:**
- Lookup buttons ONLY appear when toggle is ON AND API key is saved
- If toggle is OFF, no lookup buttons appear anywhere in the app
- If toggle is ON but no API key, lookup buttons don't appear (must save API key first)

## Example Workflow

### Officer Jane's First Use:
1. **Day 1:** Opens Settings, sees Numverify section
2. **Toggles ON** the Numverify feature
3. Clicks numverify.com link, creates free account
4. Copies API key: `abc123def456ghi789jkl012mno345pq`
5. Pastes in Settings, clicks Save
6. **Day 2:** Working a CyberTip case
7. Adds phone identifier: `(202) 555-0147`
8. Sees "📱 Lookup" button (because toggle is ON and API key is saved)
9. Clicks "📱 Lookup" button
10. Sees: "Carrier: Verizon Wireless (mobile)"
11. Carrier auto-fills, clicks Add
12. Identifier saved with carrier metadata

### Officer John (Prefers Manual Entry):
1. Never enables Numverify (toggle stays OFF)
2. Adds phone identifiers manually
3. Types carrier from other sources (carrier field is optional when toggle is OFF)
4. Never sees lookup buttons
5. Works perfectly fine without API

## Troubleshooting

### "API key not configured"
**Solution:** Go to Settings → API Keys → Add your Numverify API key

### "Invalid phone number or lookup failed"
**Possible causes:**
- Phone number format unrecognized
- Non-US number (Numverify free tier limited)
- API quota exceeded (250/month limit)
**Solution:** Manually enter carrier or try again next month

### "Request failed"
**Possible causes:**
- No internet connection
- Numverify API temporarily down
**Solution:** Check internet connection or try again later

### Lookup button disabled
**Cause:** No phone number entered yet
**Solution:** Enter phone number first, then click Lookup

## Cost Breakdown

### Free Tier (Default)
- **Cost:** $0/month per user
- **Lookups:** 250/month per user
- **Perfect for:** Most officers (10-50 lookups/month typical)

### Paid Tiers (Optional Upgrade)
If an officer exceeds 250/month:
- **Basic:** $9.99/month - 5,000 lookups
- **Professional:** $49.99/month - 50,000 lookups

*Each officer pays for their own upgrade if needed - no cost to agency*

## Future Enhancements

Possible additions:
- OSINT phone search integration
- Reverse phone lookup
- Historical carrier changes tracking
- Bulk phone number imports with batch lookup
- Export identifiers with carrier metadata

## Important Notes

- ✅ Each officer uses their own API key
- ✅ No cost to developer or agency
- ✅ 250 free lookups/month per officer
- ✅ Optional feature - works without it
- ✅ Only phone number sent (no case data)
- ✅ Stored securely in session memory
- ⚠️ Requires internet for lookups
- ⚠️ Free tier limited to select countries

## Files Modified

1. `src/shared/types.ts` - Added CarrierLookupResult interface, CARRIER_LOOKUP channel
2. `src/preload/index.ts` - Exposed carrierLookup, getSecret, setSecret methods
3. `src/main/index.ts` - Implemented Numverify API integration + secret handlers
4. `src/renderer/App.tsx` - Added TypeScript declarations
5. `src/renderer/pages/Settings.tsx` - Added API Keys section with Numverify config
6. `src/renderer/pages/CaseDetail.tsx` - Added carrier lookup button and handler for phone identifiers
