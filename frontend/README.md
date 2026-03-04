# Accelera — Frontend

**Cummins Facility Decarbonization Platform | Destination Zero**

React + Vite frontend for a multi-user, multi-agent system that helps facilities evaluate battery energy storage (BESS) deployments to reduce diesel dependence, cut carbon emissions, and take advantage of IRA incentives.

Built for the Stern Challenge by Team 2.

---

## Architecture

```
frontend/
├── index.html                  # Entry point + Google Fonts
├── src/
│   ├── main.jsx                # React root
│   ├── App.jsx                 # Auth gate, role routing, CVD toggle
│   ├── App.css                 # Full component styles (themed)
│   ├── index.css               # CSS variables + CVD palette definitions
│   ├── lib/
│   │   ├── firebase.js         # Firebase client init (Auth + Firestore)
│   │   └── api.js              # Backend helpers (SSE streaming, decisions)
│   └── pages/
│       ├── login.jsx           # Email/password sign-in
│       ├── Unauthorized.jsx    # No-role landing screen
│       ├── FacilityEngineer.jsx
│       ├── SustainabilityDirector.jsx
│       └── Auditor.jsx
```

## Role-Based Dashboards

The app routes users to a dashboard based on the `role` custom claim in their Firebase ID token.

### Facility Engineer

- **Select a facility** from Firestore (`facility_profiles`) and view key operational data (power load, diesel runtime, grid rate, IRA eligibility, etc.)
- **Add engineer notes** — free-text context, revised assumptions, or external feedback to guide the AI agents before running
- **Run Analysis** — kicks off a `POST /run` request, streams SSE events in real-time (started → running → finished), and shows the final proposal status
- **Revisions tab** — live-updating list of facilities where the Sustainability Director has requested changes. Shows director feedback, lets the engineer edit notes and re-run inline. Cards persist through the full revision cycle (revision requested → re-run → pending review) and disappear only when approved/rejected
- **History tab** — read-only log of all approved and rejected proposals

### Sustainability Director

- **Live proposal queue** via Firestore `onSnapshot` — only `pending_review` proposals, grouped by facility (one card per facility showing only the latest run)
- **Proposal detail panel** with structured sections:
  - Facility context (type, climate zone, IRA eligibility, grid outages)
  - Energy load analysis (recommended product, module count, diesel reduction, confidence)
  - Battery sizing & financial analysis (3-scenario cost comparison, gross/IRA-adjusted CapEx, payback years, NPV, CO2 avoided)
  - Flags & confidence (priority tier, IRA credit flag, NMC recommendation)
  - Full raw JSON toggle
- **Review actions** — Approve, Reject, or Request Revision (with mandatory feedback). Decisions hit `POST /proposals/{run_id}/decision` authenticated with the Firebase ID token

### Auditor

- **KPI dashboard** — total proposals, pending/approved/rejected/revision-requested counts, total agent decisions
- **Filterable audit trail** of `agent_decisions` — timestamp, agent name, facility, run ID, confidence, rationale, expandable output JSON
- **Refresh button** for on-demand data reload during demos
- Read-only — no write actions

## Design System

Themed around **Columbus, Indiana** and the **Cummins** industrial heritage:

| Token | Hex | Role |
|-------|-----|------|
| Cummins Red | `#9B2335` | Primary actions, active states |
| Girard Teal | `#1F5C5C` | Success, secondary, links |
| MCM Mustard | `#B8872E` | Warnings, accents, urgency |
| Engine Graphite | `#1E1E20` | Navbar, primary text |
| Saarinen Cream | `#FAF5EB` | Page background |
| Irwin Sand | `#E8DCC8` | Borders, dividers |

**Typography:** Outfit (display), DM Sans (headings/UI), Atkinson Hyperlegible (body), IBM Plex Mono (code/data).

### Color Vision Deficiency Modes

The navbar includes a **CVD palette toggle** with five modes:

- **Default** — full color palette
- **Deuteranopia** — red-green (most common, ~6% of males)
- **Protanopia** — red-blind (~2% of males)
- **Tritanopia** — blue-yellow blind
- **High Contrast** — maximum differentiation for low vision

All colors are defined as CSS custom properties. Switching modes applies a class to `<html>` that remaps the variables — every UI element recolors instantly. The user's choice persists in `localStorage`.

## Backend Integration

| Endpoint | Method | Used By | Purpose |
|----------|--------|---------|---------|
| `/run` | POST (SSE) | Engineer | Trigger multi-agent analysis, stream events |
| `/proposals/{run_id}/decision` | POST | Director | Submit approve/reject/revision decision |

Both require `Authorization: Bearer <Firebase ID token>`.

The `/run` endpoint returns `text/event-stream`, not standard `EventSource`-compatible GET. The frontend uses a custom `streamRun` helper that performs `fetch` with POST, reads the `ReadableStream` via `getReader()`, and manually parses SSE frames.

## Firestore Collections

| Collection | Used By | Access |
|------------|---------|--------|
| `facility_profiles` | Engineer (read) | All signed-in users |
| `proposals` | All dashboards (read), Director (write via API) | Role-based |
| `agent_decisions` | Auditor, Director (read) | Director + Auditor |

The Engineer dashboard uses a single `onSnapshot` on the entire `proposals` collection to derive revision cycles, proposal history, and per-facility status badges in real time.

## Running Locally

### Prerequisites

- Node.js 18+
- A Firebase project with Auth and Firestore enabled
- The backend server running (default: `http://localhost:8000`)

### Setup

```bash
cd frontend
npm install
```

Create a `.env` file:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_BASE_URL=http://localhost:8000
```

### Run

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Deploy to Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

## Test Users

Firebase Auth users are created manually with custom claims set via `backend/set_claims.py`:

| Role | Email Pattern |
|------|---------------|
| Facility Engineer | `engineer@team2.demo` |
| Sustainability Director | `director@team2.demo` |
| Auditor | `auditor@team2.demo` |

## Tech Stack

- **React 19** — functional components, hooks only
- **Vite 7** — dev server + build
- **Firebase 12** — Auth (email/password) + Firestore (real-time listeners)
- **CSS custom properties** — themeable palette with CVD support, no UI library
- **No router library** — role-based conditional rendering in `App.jsx`

---

*Team 2 — Purdue Stern Challenge*
