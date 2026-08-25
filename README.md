# SCHEDULE CONTROL & PROJECT GOVERNANCE
### Enterprise PMO Schedule-Control, Forecasting, RAID & Change-Control Platform

A production-quality enterprise web application designed for PMO directors, project managers, and steering committees to transform basic project plans into a complete schedule-control, CPM forecasting, RAID, change-control, and CTO-ready governance system.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    REACT 18 + VITE FRONTEND                 │
│  ┌──────────────┬──────────────┬──────────────┬───────────┐ │
│  │  Executive   │  Granular    │  Interactive │    CTO    │ │
│  │  Dashboard   │  Scheduler   │  Gantt Chart │  60s View │ │
│  ├──────────────┼──────────────┼──────────────┼───────────┤ │
│  │  Weekly      │  RAID        │  Change      │  Import   │ │
│  │  Snapshots   │  Assurance   │  Control     │  Wizard   │ │
│  └──────────────┴──────────────┴──────────────┴───────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │    ProjectContext (Global State, RBAC, Active Filters) │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST API Layer (/api)
┌──────────────────────────────┴──────────────────────────────┐
│                    NODE.JS / EXPRESS BACKEND                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ DOMAIN & SCHEDULING CALCULATION ENGINES                │ │
│  │  • CalendarEngine (Working-day math, custom calendars) │ │
│  │  • DependencyEngine (FS/SS/FF/SF, topological sort)    │ │
│  │  • CriticalPathEngine (CPM forward/backward pass)      │ │
│  │  • StatusEngine (7-state governance status rules)      │ │
│  │  • VarianceEngine (Current vs Original WD variance)    │ │
│  │  • NarrativeEngine (Auto-generated CTO narratives)     │ │
│  │  • HealthScoreEngine (8-dimension weighted index)      │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ PERSISTENCE & AUDIT LAYER (sql.js / SQLite WAL)        │ │
│  │  • 15 Relational Tables & Referential Integrity        │ │
│  │  • Immutable Baseline Versioning & Change Audit Trail  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Fundamental Schedule Governance Rules

The application strictly enforces all 10 core governance rules:

1. **RULE 1: Original Baseline Immutability** — The initial approved project commitment is permanently locked and never overwritten.
2. **RULE 2: Current Baseline Equality** — Current Baseline initially equals Original Baseline until a formal change request is approved.
3. **RULE 3: Dynamic Owner Forecasting** — Forecast finish dates reflect owner/project team weekly progression without modifying baseline commitments.
4. **RULE 4: Factual Actual Dates** — Actual finish dates take precedence over forecasts and can never be altered by speculative updates.
5. **RULE 5: Non-Automatic Rebaseline** — A missed milestone or delay does *not* trigger an automatic rebaseline.
6. **RULE 6: Formal Change Control Required** — Current Baseline can only be modified through approved Change Requests.
7. **RULE 7: Full Rebaseline Audit Trail** — Every rebaseline records Original Baseline, Previous Current Baseline, New Current Baseline, Justification, Impact Assessment, Approver, and Effective Date.
8. **RULE 8: Historical Schedule Snapshots** — Weekly snapshots freeze and preserve weekly forecasts and milestone statuses.
9. **RULE 9: No False Green** — YTS, blank forecasts, and missing actuals are never rendered as green.
10. **RULE 10: Explicit Missing Forecast Alert** — Open tasks with blank owner forecasts display `FORECAST REQUIRED`.

---

## 3. Key Scheduling Calculation Logic

### Critical Path Method (CPM)
- **Forward Pass**: $ES(j) = \max(EF(i) + lag)$ for predecessors $i$; $EF(j) = ES(j) + duration(j) - 1$ WD.
- **Backward Pass**: $LF(j) = \min(LS(k) - lag)$ for successors $k$; $LS(j) = LF(j) - duration(j) + 1$ WD.
- **Total Float (TF)**: $TF(j) = LS(j) - ES(j) = LF(j) - EF(j)$ in working days.
- **Free Float (FF)**: $FF(j) = \min(ES(k)) - EF(j) - 1 - lag$ for successors $k$.
- **Critical Path**: Activities where $Total Float \le 0$.

### Milestone Slippage vs Overall Project Delay
The application strictly distinguishes:
- **Cumulative Milestone Slippage**: The arithmetic sum of individual milestone slips (e.g. $+89\text{ WD}$).
- **Overall Project Forecast Variance**: Network-driven delay to project completion (e.g. $0\text{ WD}$ if downstream paths absorb slippage).
- When milestones are delayed but the final finish date remains on schedule, the system reports **`AT RISK - FINAL DATE PROTECTED`**.

---

## 4. Running the Application

### Option A: Running with Docker Desktop (Recommended)

Make sure **Docker Desktop** is running on your machine, then run:

```bash
# Navigate to the project folder
cd schedule-control

# Build and start container in detached mode
docker compose up --build -d
```

Or on Windows, simply double-click **`docker-start.bat`**.

Open your browser and navigate to:
👉 **`http://localhost:3001`**

#### Useful Docker Commands:
```bash
# View live container logs
docker compose logs -f

# Check container health status
docker compose ps

# Stop the application
docker compose down
```

---

### Option B: Running Locally (Node.js)

#### Prerequisites
- Node.js v18+ (Node.js v20/v24 recommended)
- npm v9+

#### Setup & Seed
```bash
# 1. Install root dependencies
npm install

# 2. Install client dependencies
cd client && npm install && cd ..

# 3. Initialize Database & Seed Demo Data
npm run db:setup

# 4. Start backend & frontend concurrently in dev mode
npm run dev
```

Open **`http://localhost:5173`** in your browser.

---

## 5. Pre-Seeded Demo Project

The database is seeded with the **Enterprise AI Platform** project demonstrating all governance rules:
- **M1 Platform POC & Finalization**: `COMPLETED - LATE` (Actual Finish: 24-Jul vs Baseline: 07-Jul, $+13\text{ WD}$)
- **M2 Commercials & Vendor Onboarding**: `DELAYED` ($+25\text{ WD}$)
- **M3 Infrastructure & Env Provisioning**: `DELAYED` ($+16\text{ WD}$)
- **M4 Core Platform Deployment**: `ON TRACK` ($-3\text{ WD}$)
- **M5 Data Foundation & Integration**: `DELAYED` ($+16\text{ WD}$)
- **M6 Application Build & Testing**: `DELAYED` ($+19\text{ WD}$)
- **M7 UAT & Go-Live Readiness**: `ON TRACK` ($0\text{ WD}$)
- **M8 Go-Live & Hypercare**: `ON TRACK` ($0\text{ WD}$)
- **Overall Status**: **`AT RISK - FINAL DATE PROTECTED`** (0 WD Project Delay, 89 WD Cumulative Milestone Slippage)

---

## 6. Testing the Excel Import Wizard

A ready-to-use Excel project plan is included in `demo/sample_project_plan.xlsx`.
1. Navigate to **Excel Import Wizard** from the left sidebar.
2. Upload `demo/sample_project_plan.xlsx`.
3. View the auto-detected column mappings.
4. Review the 12-point PMP validation report.
5. Click **Import & Transform to Schedule Control System** to generate a new live project.

---

## 7. Running Automated Tests
```bash
npm run test
```
Runs the Vitest suite covering calendar engine, working-day arithmetic, circular dependency detection, CPM forward/backward passes, Total Float/Free Float calculations, and governance status logic.
