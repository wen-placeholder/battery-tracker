# Battery Cell Tracker

A full-stack web application for tracking BMW battery cells through their lifecycle — from intake to testing, storage, and final disposition.

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
