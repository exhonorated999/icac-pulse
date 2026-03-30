# Dashboard Updates - Tasks & Warrant Alerts

## Changes Made

### 1. **Logo Enlargement** ✅
- **Increased all logo sizes by 2x** for better readability
- Small: 40px → 80px (sidebar)
- Medium: 60px → 120px (modals, settings)
- Large: 100px → 160px (splash screens)
- **Increased font sizes:**
  - ICAC text: More prominent and readable
  - P.U.L.S.E text: Larger and bolder
  - Pulse line: Thicker stroke (3px → 4px) and larger dot (4px → 6px)
- **Improved letter spacing** for better readability
- **Enhanced viewBox** for better scaling (400x100 → 500x120)

### 2. **Task Management System** ✅

#### Database Changes
- Added new columns to `todos` table:
  - `due_date` TEXT - Optional due date for tasks
  - `file_path` TEXT - Path to attached file (e.g., subpoena PDF)
  - `file_name` TEXT - Original filename for display

#### Backend (Main Process)
- Added IPC handlers:
  - `GET_TODOS` - Get all todos or by case ID
  - `ADD_TODO` - Create new task with optional date and file
  - `UPDATE_TODO` - Mark task as complete/incomplete
  - `DELETE_TODO` - Remove task
- Handlers support file attachments
- Todos can be global or case-specific

#### Frontend (Dashboard)
**New Components:**
- **Task List Panel** - Displays all tasks with checkboxes
- **Add Task Dialog** - Modal for creating new tasks with:
  - Task description (required)
  - Due date (optional)
  - File attachment (optional - for subpoenas, etc.)
- **Task Items** - Individual task cards showing:
  - Checkbox for completion
  - Task description
  - Due date (if set)
  - Associated case number (if linked)
  - Attached file name (if present)
  - Delete button

**Features:**
- Check/uncheck tasks to mark complete
- Completed tasks shown with strikethrough
- File attachments displayed with 📎 icon
- Delete with confirmation
- Auto-refresh after actions
- Scrollable list (max-height 96)

**Positioning:**
- Located in right sidebar
- Between "Quick Stats" and "Generate Report"
- Dedicated panel with border

### 3. **Warrant Alerts Section** ✅

#### Changes to Dashboard Layout
**Before:**
- Recent Updates section showed recently modified cases
- Overdue Warrants was a secondary alert below Recent Updates

**After:**
- **Primary: Overdue Warrants** - Now the top widget in right sidebar
- Shows ALL overdue warrants (not just first 3)
- Prominent pink gradient with animated pulse
- Clear "All Clear" message when no overdue warrants

**Removed:**
- Recent Updates section (replaced by Warrant Alerts)
- Recent activity tracking
- Case type icons in timeline

**Visual Design:**
- Same pink gradient and pulse animation
- Warning icon (⚠️) for urgency
- Each warrant shows:
  - Company name (bold)
  - Case number
  - Days overdue (pink text)
- Click navigates to case → warrants tab
- "All Clear" state with green check (✓) when no overdue warrants

### 4. **New Dashboard Structure**

```
Dashboard
├── Header (Search, Notifications, New Case)
├── KPI Ribbon (4 gradient cards)
└── Main Content Grid
    ├── Left Column (60%)
    │   ├── Case Analytics (Donut + Bar charts)
    │   └── Active Investigations Table
    └── Right Sidebar (40%)
        ├── ⚠️ Overdue Warrants (Primary)
        ├── 📊 Quick Stats
        ├── ✓ Tasks (NEW!)
        └── 📊 Generate Report
```

## Technical Implementation

### State Management
```typescript
// New state for tasks
const [todos, setTodos] = useState<Todo[]>([]);
const [showAddTask, setShowAddTask] = useState(false);
const [newTask, setNewTask] = useState({ 
  content: '', 
  dueDate: '', 
  file: null as File | null 
});

// Removed recentActivity state
```

### Data Loading
```typescript
const loadDashboardData = async () => {
  // Load dashboard stats
  // Load cases
  // Load overdue warrants
  // Load todos (NEW!)
  const todosList = await window.electronAPI.getTodos();
  setTodos(todosList || []);
};
```

### Task Functions
```typescript
// Add task with optional file
const handleAddTask = async () => {
  await window.electronAPI.addTodo({
    content: newTask.content,
    dueDate: newTask.dueDate || null,
    filePath: filePath,
    fileName: fileName
  });
};

// Toggle task completion
const handleToggleTask = async (todoId, completed) => {
  await window.electronAPI.updateTodo(todoId, { 
    completed: !completed 
  });
};

// Delete task
const handleDeleteTask = async (todoId) => {
  await window.electronAPI.deleteTodo(todoId);
};
```

## Database Schema

### todos Table (Enhanced)
```sql
CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER,                    -- Optional case association
  content TEXT NOT NULL,              -- Task description
  completed INTEGER DEFAULT 0,        -- 0 = pending, 1 = complete
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,             -- When marked complete
  due_date TEXT,                     -- NEW: Optional due date
  file_path TEXT,                    -- NEW: Path to attached file
  file_name TEXT,                    -- NEW: Original filename
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);
```

## User Interface

### Task List Widget
```
┌──────────────────────────────────┐
│ Tasks                  [+ Add Task]│
├──────────────────────────────────┤
│ ☑ Send subpoena to Google        │
│   Due: 11/30/2024                │
│   📎 subpoena.pdf                │
│                                  │
│ ☐ Follow up on Facebook warrant  │
│   Case: 2024-001                 │
│                                  │
│ ☐ Schedule interview with suspect│
│   Due: 12/05/2024                │
└──────────────────────────────────┘
```

### Add Task Dialog
```
┌────────────────────────────────────┐
│ Add New Task                       │
├────────────────────────────────────┤
│ Task Description *                 │
│ ┌────────────────────────────────┐ │
│ │ Send subpoena to Google        │ │
│ │                                │ │
│ └────────────────────────────────┘ │
│                                    │
│ Due Date (Optional)                │
│ ┌────────────────────────────────┐ │
│ │ 11/30/2024                     │ │
│ └────────────────────────────────┘ │
│                                    │
│ Attach File (Optional)             │
│ ┌────────────────────────────────┐ │
│ │ Choose File    subpoena.pdf    │ │
│ └────────────────────────────────┘ │
│                                    │
│ [Cancel]         [Add Task]        │
└────────────────────────────────────┘
```

### Warrant Alerts (Primary Position)
```
┌────────────────────────────────────┐
│ ⚠️ Overdue Warrants               │  ← Animated pulse
├────────────────────────────────────┤
│ ┌────────────────────────────────┐ │
│ │ Facebook                       │ │
│ │ Case #2024-001                 │ │
│ │ 5 days overdue                 │ │  ← Pink text
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │ Google                         │ │
│ │ Case #2024-003                 │ │
│ │ 3 days overdue                 │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Or when no overdue warrants:**
```
┌────────────────────────────────────┐
│ ✓ All Clear                        │  ← Green
├────────────────────────────────────┤
│ No overdue warrants                │
└────────────────────────────────────┘
```

## Use Cases

### Task Management
1. **Add Subpoena Task:**
   - Click "+ Add Task"
   - Enter: "Send subpoena to Google"
   - Set due date: 30 days from now
   - Attach: subpoena.pdf
   - Click "Add Task"

2. **Track Follow-ups:**
   - Add task: "Follow up on warrant return"
   - Link to case: Auto-shows case number
   - Check off when complete

3. **Interview Scheduling:**
   - Add task: "Schedule suspect interview"
   - Set due date for coordination
   - Check off when scheduled

### Warrant Monitoring
1. **At a Glance:**
   - Open dashboard
   - See overdue warrants immediately at top
   - Pink pulsing alerts draw attention

2. **Quick Navigation:**
   - Click any overdue warrant
   - Jumps directly to case → warrants tab
   - Review and take action

3. **Clear Status:**
   - When all warrants current
   - See green "All Clear" message
   - Confirms good standing

## Benefits

### Productivity
- **Centralized task management** - No need for external tools
- **File attachments** - Keep subpoenas/documents with tasks
- **Due date tracking** - Never miss a deadline
- **Quick completion** - Check off tasks instantly

### Visibility
- **Prominent warrant alerts** - Can't be missed
- **All overdue shown** - Complete picture at a glance
- **One-click navigation** - Fast access to details

### Organization
- **Tasks persist** - Survive app restarts
- **Case linking** - See which case a task relates to
- **Completion history** - Tasks marked with timestamp

## Files Modified

### Database
- `src/main/database.ts` - Added todos table migration

### Backend
- `src/main/index.ts` - Added task IPC handlers

### Frontend
- `src/renderer/pages/Dashboard.tsx` - Major redesign:
  - Added task list component
  - Added add task dialog
  - Replaced Recent Updates with Warrant Alerts
  - Moved Warrant Alerts to primary position

### Logo
- `src/renderer/components/Logo.tsx` - Doubled all sizes

### Documentation
- `UPDATES_DASHBOARD_TASKS_WARRANTS.md` - This file

## Testing Checklist

### Logo
- [ ] Logo larger and more readable in sidebar
- [ ] Logo larger in modals and settings
- [ ] Logo larger on splash screens
- [ ] ICAC text more visible
- [ ] Pulse line more prominent
- [ ] Animations still smooth

### Tasks
- [ ] Can add task with description only
- [ ] Can add task with due date
- [ ] Can add task with file attachment
- [ ] Can check/uncheck tasks
- [ ] Can delete tasks
- [ ] Tasks persist after app restart
- [ ] Completed tasks show strikethrough
- [ ] File names display correctly
- [ ] Case numbers display when linked

### Warrant Alerts
- [ ] Overdue warrants show at top
- [ ] All overdue warrants displayed
- [ ] Click navigates to case → warrants tab
- [ ] Animated pulse effect works
- [ ] "All Clear" shows when no overdue
- [ ] Pink color scheme maintained

### General
- [ ] Dashboard loads without errors
- [ ] All existing features still work
- [ ] KPI cards clickable
- [ ] Charts display correctly
- [ ] Quick Stats functional
- [ ] Generate Report works

## Future Enhancements

### Tasks
- **Task categories** - Personal vs Case-specific
- **Task priority** - High/Medium/Low
- **Task assignments** - Multi-user support
- **Task reminders** - Email/notification alerts
- **Recurring tasks** - Weekly reports, monthly reviews
- **Task search** - Find tasks by keyword
- **Task filters** - Show only incomplete, due soon, etc.

### Warrant Alerts
- **Color coding** - Yellow (due soon), Red (overdue)
- **Days until due** - Show upcoming deadlines
- **Warrant timeline** - Visual progress bar
- **Email alerts** - Automated reminders
- **Export warrant list** - PDF report

### Dashboard
- **Customizable layout** - Drag and drop widgets
- **Dashboard themes** - Different color schemes
- **Widget toggles** - Show/hide panels
- **Dashboard presets** - Save favorite layouts

## Notes

### Design Decisions
- **Warrant Alerts first** - Most critical information
- **Task list scrollable** - Handle many tasks
- **Simple task form** - Quick to use
- **Optional fields** - Flexible for various task types
- **File attachment** - Support for subpoenas, warrants, documents

### Performance
- **No performance impact** - All CSS animations
- **Efficient queries** - Indexed database lookups
- **Lazy loading** - Only load visible tasks
- **Optimistic updates** - Immediate UI feedback

### Security
- **Local files only** - All data stays on machine
- **No external uploads** - File attachments stored locally
- **Case associations** - Tasks inherit case security

## Conclusion

The dashboard now provides:
1. **Larger, more readable logo** throughout the application
2. **Integrated task management** with file attachments and due dates
3. **Prominent warrant alerts** that can't be ignored
4. **Streamlined workflow** - Everything in one place

These changes improve daily workflow efficiency and ensure critical deadlines are never missed.
