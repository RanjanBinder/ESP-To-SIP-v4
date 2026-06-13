# Sprint Dashboard

A self-contained HTML dashboard that turns a sprint report (`.xlsx` / `.xls` / `.csv`)
into an interactive sprint demo dashboard. No server, no build step — just open
`dashboard.html` in a browser and load your report file (or click **Load Demo Data**).

Layout and visual style follow the **Sprint Dashboard — Design Concept v1.0**:
six bands ordered by the question they answer, light "delivery report" styling,
size signals importance / color signals state.

---

## The Six Bands

| Band | Section | What it shows |
|---|---|---|
| 1 | **Sticky header** | Project, sprint number, date range, PM · man-hours · members, and the **Sprint Health badge** (Healthy / At Risk / Off Track) |
| 2 | **KPI strip** | SP Committed · SP Done (Δ vs last sprint) · Sprint Completion % (hero card with radial) · Velocity (vs 3-sprint avg) · Velocity Gap |
| 3 | **Sprint goals** | Each goal with owner, slim progress bar, status badge, and a "X of Y goals met" chip |
| 4 | **Charts grid (2×2)** | Ticket status donut · Committed vs Done trend with velocity line · Epic vs story points · Work item type donut |
| 5 | **Team workload + bug health (60/40)** | Status by assignee (stacked SP bars with totals) · Bug funnel tiles + pipeline bar (re-opened gets red "needs attention" treatment; zero = clean sprint) |
| 6 | **Ticket table** | Searchable, sortable, filterable detail table (Type / Status / Epic / Assignee / Priority) with dismissible filter chips |

**Sprint Health rule:** completion ≥ 85% **and** 0 re-opened bugs → 🟢 Healthy ·
completion < 60% → 🔴 Off Track · otherwise → 🟡 At Risk.

**Cross-filtering:** clicking a donut segment, epic bar, or assignee bar applies the
matching table filter and scrolls to the table. Problems sort to the top by default
(Re-opened → Blocked → In Progress → To Do → Done).

---

## Expected File Format

### Option A — One `.xlsx` workbook with 3–4 sheets (recommended)

**Sheet `Summary`** — two columns, `Field` and `Value`:

| Field | Value |
|---|---|
| Project | Project Phoenix |
| Sprint No | 14 |
| Sprint Name | (optional) |
| Start Date | 2026-04-01 |
| End Date | 2026-04-14 |
| Project Manager | Priya Sharma |
| Man Hours | 480 |
| Members | 6 |
| Story Points Committed | 85 |
| Story Points Done | 72 |
| Sprint Velocity | 72 |

**Sheet `Goals`** — one row per goal (`Owner` and `Progress` are optional):

| Goal | Owner | Status | Progress |
|---|---|---|---|
| Launch payment gateway v2 | Rahul | Done | 100 |
| Reduce API p95 latency < 300ms | Vikram | Partial | 65 |
| Mobile push notifications | Meera | Not Done | 10 |

**Sheet `Tickets`** — one row per ticket (`Priority` and `Remarks` are optional):

| Key | Summary | Type | Epic | Story Points | Status | Assignee | Priority | Remarks |
|---|---|---|---|---|---|---|---|---|
| PHX-201 | Payment retry logic | Story | Payments | 5 | Done | Rahul | High | |
| PHX-238 | Cart total mismatch | Bug | Checkout UX | 2 | Re-opened | Arjun | High | Failed retest |

**Sheet `History`** *(optional)* — past sprints, used for the Committed-vs-Done trend
chart, the SP-Done delta chip, and the 3-sprint velocity average:

| Sprint | Committed | Done |
|---|---|---|
| S10 | 72 | 65 |
| S11 | 75 | 68 |
| S12 | 80 | 76 |
| S13 | 78 | 66 |

Without a History sheet the trend chart shows only the current sprint and the
velocity / delta chips are omitted.

### Option B — A single `.csv`
A lone CSV is treated as the **Tickets** sheet. Summary/Goals values are then
inferred from the tickets where possible. For full fidelity use the workbook.

---

## Accepted Column Aliases (case-insensitive)

The parser is tolerant of common naming variations:

- **Key**: `Key`, `Ticket`, `Ticket ID`, `ID`, `Issue`
- **Summary**: `Summary`, `Title`, `Name`, `Description`
- **Type**: `Type`, `Issue Type`, `Work Type`
- **Epic**: `Epic`, `Epic Link`, `Feature`
- **Story Points**: `Story Points`, `SP`, `Points`, `Estimate`
- **Status**: `Status`, `State`
- **Assignee**: `Assignee`, `Owner`, `Developer`
- **Priority**: `Priority`, `Prio` (normalized to High / Medium / Low)
- **Remarks**: `Remarks`, `Comment(s)`, `Notes`, `Root Cause`

### Status normalization
Statuses are grouped into: **To Do**, **In Progress**, **Done**, **Re-opened**, **Blocked**.
For the bug funnel, bug statuses additionally map **Closed/Resolved → Closed**;
every bug counts toward **Opened**.

---

## Usage
1. Open `dashboard.html` in any modern browser.
2. Drag-drop your report or click **Choose File**.
3. Or click **Load Demo Data** to see the fully populated Sprint 14 sample.
4. **Export ⎙** in the header prints / saves the dashboard as a PDF.

Send me your actual template `.xlsx` and I'll tune the column mapping to match it exactly.
