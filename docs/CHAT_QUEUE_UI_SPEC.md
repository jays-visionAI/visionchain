# Chat Top Queue UI/UX Specification

## 1. Goal
Implement a dynamic **Active Queue Line** at the top of the Chat interface to visualize ongoing asynchronous tasks, starting with TimeLock Scheduled Transfers.
When a user creates a scheduled transfer, a corresponding **Agent Chip** appears in this queue, providing real-time status visibility without cluttering the main chat stream.

## 2. Status Definitions & Visuals

| Status | Visual Style | Animation | Interaction |
| :--- | :--- | :--- | :--- |
| **WAITING** | **Blue Glowing Border** (Strong) | Pulse | Click to open Detail/Cancel Modal |
| **EXECUTING** | **Amber/Purple Gradient** | Spinner / Progress Bar | Click to view Progress |
| **SENT** | **Green Solid** | Fade out (after 5s) | Click to view TX Hash |
| **FAILED** | **Red Solid** | Shake (on mount) | Click to Retry/View Error |
| **CANCELLED** | Grey / Dimmed | None | Sent to History |
| **EXPIRED** | Grey / Strike-through | None | Sent to History |

## 3. Active vs History Policy
To keep the Chat interface clean, the Top Queue Line works as a "Focus Area":

- **Active Queue (Visible)**:
    - Contains items in `WAITING` or `EXECUTING` state.
    - Also holds `SENT`/`FAILED` items temporarily (e.g., 10 seconds) for user feedback before dismissing.
- **History Drawer (Hidden/Expandable)**:
    - Contains all terminal states (`SENT`, `FAILED`, `CANCELLED`, `EXPIRED`).
    - Accessed via a "History" button or "View All" link if the Active Queue is empty or user requests it.

## 4. Component Structure
- `ChatQueueLine`: The container fixed at the top of the chat (below header).
- `AgentChip`: The individual item representing a task (e.g., TimeLock Transfer).
    - Props: `taskId`, `type` (TimeLock, Bridge, etc.), `status`, `summary`, `timeLeft`.

## 5. Interaction Flow
1. **Creation**: User signs "Schedule 100 VCN".
2. **Mount**: `AgentChip` appears in Queue Line with `WAITING` status (Blue Glow).
3. **Update**: Real-time countdown (e.g., "In 29m") displayed on the chip.
4. **Execution**: Server triggers execute -> Chip changes to `EXECUTING` (Spinner).
5. **Completion**: Chip turns Green (`SENT`), stays for 5s, then moves to History.
