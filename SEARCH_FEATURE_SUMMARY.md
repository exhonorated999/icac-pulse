# Offense Reference Search Feature

## Overview
Added a powerful search bar to the Offense Reference page that makes finding specific charges quick and easy.

## What It Does

The search bar searches across **all offense fields**:
- ✓ Charge codes
- ✓ Charge descriptions
- ✓ Seriousness level
- ✓ Sentencing ranges
- ✓ Additional notes

## How It Works

### Real-Time Filtering
- Type anything in the search bar
- Results filter instantly as you type
- No need to press Enter or click Search
- Matching text is **highlighted in cyan**

### Search Examples

**By Charge Code:**
```
Search: "311"
Finds: PC 311.11(a), PC 311.1, PC 311.2, etc.
```

**By Keyword:**
```
Search: "manufacture"
Finds: All offenses containing "manufacture" anywhere in text
```

**By Phrase:**
```
Search: "hidden camera"
Finds: Offenses with that exact phrase
```

**By Seriousness:**
```
Search: "felony"
Finds: All felony offenses
```

**By Sentencing:**
```
Search: "2, 3, or 4"
Finds: Offenses with that sentencing structure
```

## User Interface

### Search Bar Features:
1. **Large input field** - Easy to see and type
2. **Search icon** - Visual indicator on left
3. **Clear button** (X) - Appears when typing, clears search instantly
4. **Result count** - Shows "Found X offenses matching 'query'"
5. **Placeholder text** - Examples of what to search

### Search Results:
- **Highlighted matches** - Matching text shown in cyan background
- **Maintains order** - Results stay in your custom drag-drop order
- **Empty state** - If no results, shows helpful "No Results Found" message with clear button

## Use Cases

### Scenario 1: Quick Charge Lookup
**User needs:** Find possession charge
```
1. Type "possession"
2. Instantly see all possession-related offenses
3. Matching word highlighted in each result
4. Copy the needed charge description
```

### Scenario 2: Finding by Partial Code
**User needs:** Remember it's PC 311 something
```
1. Type "311"
2. See all PC 311 charges
3. Scroll through to find the right one
4. Click Edit to view full details
```

### Scenario 3: Concept Search
**User needs:** Find charges related to recording
```
1. Type "record"
2. See "recording device", "videotaping", etc.
3. Find PC 647(j)(3) - Viewing matter under clothing
4. Reference elements in notes
```

### Scenario 4: Multiple Keywords
**User needs:** Find child pornography manufacture charges
```
1. Search "manufacture" first
2. Narrow down from results
3. Or clear and search "child pornography"
4. Compare different charges
```

## Technical Details

### Search Algorithm:
- Case-insensitive matching
- Searches all text fields simultaneously
- Returns any offense with at least one match
- Preserves custom display order
- No database query needed (filters in memory)

### Highlight Function:
- Wraps matching text in `<mark>` element
- Cyan background (#00D4FF with 30% opacity)
- Case-insensitive highlighting
- Works with partial matches

### Performance:
- Instant filtering (no lag)
- Efficient even with 100+ offenses
- No network calls
- All processing on frontend

## Benefits

### For Officers:
- **Faster research** - Find charges in seconds vs. minutes
- **Better accuracy** - See exact matches highlighted
- **Easy exploration** - Try different keywords
- **No memorization needed** - Search by concept, not code

### For Units:
- **Consistency** - Everyone finds same charges
- **Training** - New officers can explore charges
- **Efficiency** - Less time searching, more time investigating
- **Knowledge sharing** - Search reveals related offenses

## Implementation

**Files Modified:**
- `src/renderer/pages/OffenseReference.tsx`
  - Added `searchQuery` state
  - Added filter logic
  - Added highlight function
  - Updated UI with search bar
  - Added empty states

**No Backend Changes Required:**
- All filtering happens in React
- Uses existing offense data
- No new IPC channels needed
- No database changes

## Usage Tips

1. **Start broad, then narrow** - Search "child" then "child pornography"
2. **Use partial codes** - "311" finds all PC 311 charges
3. **Search by crime type** - "hidden camera", "voyeurism", etc.
4. **Try synonyms** - "record" vs "videotape" vs "filming"
5. **Clear often** - Hit X to reset and try new search
6. **Check highlights** - See exactly where match occurred

## Keyboard Shortcuts

- **Tab** to jump to search bar
- **Escape** to clear search (when focused on search)
- **Type to search** - No enter key needed
- **Ctrl+F** (browser) still works for page-level search

## Future Enhancements

Potential improvements:

1. **Search history** - Remember recent searches
2. **Advanced filters** - Combine with seriousness dropdown
3. **Regex support** - For power users
4. **Search suggestions** - Autocomplete based on common terms
5. **Save searches** - Bookmark common search queries
6. **Export results** - Export filtered list to PDF
7. **Multi-field search** - Search code AND description separately
8. **Fuzzy matching** - Find "manafacture" when user meant "manufacture"

## Testing

To test the search feature:

1. Add several offenses with diverse content
2. Try these searches:
   - Single letter: "a"
   - Partial code: "311"
   - Full code: "PC 311.11(a)"
   - Keyword: "manufacture"
   - Phrase: "hidden camera"
   - Sentencing: "2, 3, or 4"
   - Seriousness: "felony"
3. Verify highlighting works
4. Test clear button
5. Try search with no results
6. Verify order maintained in results

---

## Summary

The search feature transforms Offense Reference from a static list into a **powerful research tool**. Officers can now find any charge in seconds using keywords, codes, or phrases - making report writing and charging decisions much faster.

**Search is live immediately after adding offenses - no setup required!**
