# Battery Cell Tracker

A full-stack web application for tracking BMW battery cells through their lifecycle — from intake to testing, storage, and final disposition.

## Demo

▶ [Watch Demo Video](https://youtu.be/ARKZAYKnhDw)

## Features

- **Dashboard** — real-time overview of cell counts by state with progress bars
- **Cell List** — filterable table by state and batch number, with CSV export
- **Cell Timeline** — per-cell detail view with full event history and state update form
- **CSV Import** — bulk import cells from CSV with per-row error reporting
- **State Management** — enforced state transitions across 7 lifecycle stages

### Cell States

| State | Description |
|---|---|
| Received | Cell arrived in warehouse |
| Incoming QC | Under initial quality check |
| Storage | Stored and awaiting test |
| Under Test | Active testing in progress |
| Passed | Test passed, ready for use |
| Failed | Test failed |
| Disposed | Cell retired and removed |

## Tech Stack

**Frontend**
- React 19 + Vite
- MUI v9 (Material UI)
- React Router v7
- Axios

**Backend**
- Node.js + Express
- MySQL (mysql2)
- Multer (CSV upload)
- csv-parse

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8.0+

### Database Setup

```sql
-- Run the schema file to create the database and tables
mysql -u root -p < backend/src/db/schema.sql
```

### Backend

```bash
cd backend
npm install
cp .env.example .env      # fill in your DB credentials
node src/index.js
```

Backend runs on `http://localhost:3001`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## CSV Import Format

The import endpoint accepts `.csv` files with the following columns:

| Column | Required | Example |
|---|---|---|
| cell_id | Yes | CELL-001 |
| manufacturer | Yes | Panasonic |
| chemistry | Yes | NMC / NCA / LFP |
| capacity_mah | Yes | 3000 |
| voltage_nominal | Yes | 3.6 |
| batch_number | No | BATCH-2025-A |
| received_date | Yes | 2025-01-15 |
| notes | No | Initial intake |

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/cells` | List cells (supports `state`, `batch`, `page`, `limit`) |
| GET | `/api/cells/export` | Export filtered cells as CSV |
| GET | `/api/cells/:cellId` | Get single cell |
| GET | `/api/cells/:cellId/events` | Get cell event history |
| PATCH | `/api/cells/:cellId/state` | Update cell state |
| GET | `/api/states` | List all valid states |
| GET | `/api/dashboard` | Get cell count by state |
| POST | `/api/import` | Import cells from CSV |

## Questions & Decision Log

### 1. Where to store `current_state` — `cells` table or derived from events?

**Options considered:**

- **Option A (chosen):** Store `current_state` directly on the `cells` table as a redundant column, updated on every state change.
- **Option B:** Derive the current state by querying the latest record in `cell_events` each time it is needed.

**Decision: Option A.**

The Cell List page displays the current state of every cell in a single table view. With Option B, fetching N cells would trigger N additional queries to `cell_events` to resolve each cell's latest state — a classic N+1 problem. Since this application is read-heavy (the list is the most frequently accessed view), the redundancy in Option A is the right trade-off.

The cost is discipline: every state update must atomically write to both `cells` (UPDATE) and `cell_events` (INSERT) inside a single database transaction. This is enforced in every relevant route handler, ensuring the two tables never fall out of sync.

---

### 2. How to model `event_type` — and how does color-coding map to it?

**Options considered:**

- **Option A (chosen):** Use `ENUM('state_change', 'correction', 'note')` for `event_type`, and determine color-coding by inspecting `to_state` for pass/fail outcomes.
- **Option B:** Add `'passed'` and `'failed'` as explicit `event_type` values to directly match the assignment's color-coding language.

**Decision: Option A.**

The assignment states *"color-coded by event type (pass = green, fail = red, correction = orange)"*, but "pass" and "fail" describe the **outcome** of a state change, not a separate category of event. A transition to `Passed` is still a `state_change` — the same mechanism as any other transition. Introducing `'passed'` and `'failed'` as event types would create overlap with the `to_state` field and blur what `event_type` is meant to represent.

Color logic therefore uses both fields: `event_type` determines whether something is a `correction` (orange) or a `note` (purple), while `to_state` determines whether a state change should render green (`Passed`) or red (`Failed`). This keeps the event model semantically clean.

The three `event_type` values reflect three distinct real-world actions:
- `state_change` — lifecycle progression (the primary operation)
- `correction` — an operator correcting a previous entry error
- `note` — an observation logged without changing state (e.g. "minor surface oxidation noted, monitoring")

---

### 3. Should state transitions be unrestricted, strictly ordered, or partially constrained?

**Options considered:**

- **Option A:** Allow any transition between any two states (fully unrestricted).
- **Option B:** Enforce strict forward-only progression through the lifecycle.
- **Option C (chosen):** Partial constraints — block logically impossible transitions, allow everything else.

**Decision: Option C.**

A strict forward-only rule (Option B) is too rigid for a real lab environment. Cells may need to return to `Storage` from `Under Test` if a test run is aborted, or be moved from `Failed` back to `Under Test` for a re-test. The `correction` event type exists precisely to support these operational realities.

However, fully unrestricted transitions (Option A) allow nonsensical operations — most critically, reactivating a disposed cell (`Disposed → Received`), which would corrupt the integrity of the audit trail.

**Chosen constraints:**
- `Disposed` is a **terminal state**: no further transitions are permitted once a cell is disposed.
- `Passed` and `Failed` **cannot revert to `Received` or `Incoming QC`**: once through testing, a cell should not re-enter the intake process as if newly arrived.
- All other transitions remain permitted, preserving the flexibility needed for real lab workflows.

This is enforced at two levels: the backend rejects invalid transitions with HTTP 422 and a descriptive error message, and the frontend proactively removes forbidden options from the state dropdown — so users see only valid choices and never encounter a confusing rejection after submitting.

---

## Project Structure

```
battery-tracker/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── connection.js
│   │   │   └── schema.sql
│   │   ├── routes/
│   │   │   ├── cells.js
│   │   │   ├── import.js
│   │   │   └── states.js
│   │   └── index.js
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── CellList.jsx
    │   │   └── CellTimeline.jsx
    │   ├── App.jsx
    │   ├── api.js
    │   └── main.jsx
    └── package.json
```
