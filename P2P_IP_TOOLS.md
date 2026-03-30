# P2P IP Address Tools Feature

## Overview
Added two investigative tools to the P2P case overview tab for IP address analysis:

1. **ARIN Lookup** - Automatically determines ISP provider via ARIN WHOIS
2. **Ping Tool** - Tests if IP address is currently active/responding

## Features

### 1. ARIN Lookup Button
- **Location:** Next to "Suspect IP Address" in P2P Overview tab (view mode)
- **Icon:** 🔍 ARIN Lookup
- **Functionality:**
  - Queries ARIN's RESTful API: `https://whois.arin.net/rest/ip/{ipAddress}`
  - Extracts organization/ISP name from response
  - Auto-populates "ISP Provider" field with result
  - Saves result to database immediately
  - Shows toast notification with provider name

**Example Use Case:**
```
IP: 47.152.63.33
Click "ARIN Lookup" → 
Result: "Verizon Online LLC" → 
Auto-fills ISP Provider field
```

### 2. Ping Tool Button
- **Location:** Next to "Suspect IP Address" in P2P Overview tab (view mode)
- **Icon:** 📡 Ping
- **Functionality:**
  - Executes system ping command (4 packets)
  - Windows: `ping -n 4 {ipAddress}`
  - Linux/Mac: `ping -c 4 {ipAddress}`
  - Parses response for:
    - Alive/Dead status
    - Average response time (ms)
    - Packet loss percentage
  - Shows toast with results

**Example Results:**
- **Alive:** "Host is ALIVE! Average response time: 23ms"
- **Dead:** "Host is NOT responding (offline or blocked)"

## UI/UX Details

### Button Appearance
- Small buttons with icons and text
- Cyan border matching app theme
- Hover effect: cyan background overlay
- Only visible when IP address exists
- Positioned to the right of "Suspect IP Address" label

### Toast Notifications
- **Info:** "Looking up ISP provider via ARIN..." / "Pinging {IP}..."
- **Success:** Shows provider name or ping results
- **Error:** Shows specific error message

## Technical Implementation

### Files Modified

#### 1. `src/shared/types.ts`
- Added `ArinLookupResult` interface
- Added `PingResult` interface
- Added IPC channels: `ARIN_LOOKUP`, `PING_IP`

#### 2. `src/preload/index.ts`
- Exposed `arinLookup(ipAddress: string)` method
- Exposed `pingIp(ipAddress: string)` method

#### 3. `src/main/index.ts`
- Implemented ARIN lookup handler using Node.js `https` module
- Implemented ping handler using Node.js `child_process.exec`
- Parses ARIN JSON response for organization name
- Parses ping output for status and timing

#### 4. `src/renderer/pages/CaseDetail.tsx`
- Added `handleArinLookup()` function
- Added `handlePingIp()` function
- Modified UI to add buttons next to IP address field
- Auto-saves ARIN results to database
- Shows toast notifications for user feedback

#### 5. `src/renderer/App.tsx`
- Added TypeScript declarations for new methods

### Network Requests
**Important:** These tools make legitimate investigative network requests:
- ARIN API: `https://whois.arin.net/rest/ip/{ipAddress}`
- Ping: Local system command (ICMP packets)

**Note:** Unlike telemetry, these are optional investigative tools initiated by the officer. No case data is transmitted - only the IP address being investigated.

## Usage Workflow

### ARIN Lookup Workflow
1. Officer opens P2P case with suspect IP
2. Views "Suspect IP Address" field
3. Clicks "ARIN Lookup" button
4. System queries ARIN API
5. ISP Provider auto-populates
6. Result saved to database
7. Toast confirms success

### Ping Workflow
1. Officer opens P2P case with suspect IP
2. Views "Suspect IP Address" field
3. Clicks "Ping" button
4. System pings IP (4 packets)
5. Toast shows if alive/dead + response time
6. Officer notes if suspect is still active

## Error Handling

### ARIN Lookup Errors
- No network connection
- ARIN API unavailable
- Invalid IP format
- No results from ARIN

### Ping Errors
- No network connection
- Firewall blocking ICMP
- Host not responding
- Invalid IP format

All errors display user-friendly toast messages.

## Testing Checklist

- [ ] ARIN lookup with valid public IP
- [ ] ARIN lookup with private IP (should fail gracefully)
- [ ] Ping with active IP (should show alive + timing)
- [ ] Ping with inactive IP (should show not responding)
- [ ] Buttons only appear when IP exists
- [ ] Results save to database correctly
- [ ] Toast notifications display properly
- [ ] Works on Windows/Linux/Mac
- [ ] No network errors crash the app

## Future Enhancements

Possible additions:
- Traceroute tool
- GeoIP location lookup
- Port scanning (basic)
- Historical IP ownership lookup
- Bulk IP lookup from CSV

## Security Considerations

- Only IP address is transmitted (no case data)
- Uses official ARIN API (trusted source)
- Ping uses system commands (no third-party service)
- All network requests are optional and user-initiated
- Officer can work offline if not using these tools
