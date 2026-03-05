# Destination Zero Dashboard — Full Codebase Guide

A plain-English walkthrough of how everything works. Read this, then take the quiz until you get it.

---

## Part 1: The Big Picture

**What is this app?**  
A web app where Facility Engineers run AI analyses on facilities, Sustainability Directors review the results, and Auditors see an audit trail. The AI is a pipeline of three agents that evaluate facilities for battery deployment.

**Two main parts:**
1. **Frontend** — The website you see (React). Runs in the browser.
2. **Backend** — The server (FastAPI). Runs the AI, talks to the database.

**Data lives in Firestore** — Google’s cloud database. Both frontend and backend read/write it.

---

## Part 2: How a User Gets In

### index.html
- The single HTML file. Loads fonts from Google, has a `<div id="root">` where React will render everything.
- **Purpose:** Entry point. The browser loads this, then runs the JavaScript.

### main.jsx
- Imports React, `index.css`, and `App.jsx`. Calls `createRoot(document.getElementById('root')).render(<App />)`.
- **Purpose:** Boots React and mounts the `App` component into the page.

### firebase.js (lib/firebase.js)
- **Firebase** = Google’s backend-as-a-service (auth, database, etc.).
- Uses `initializeApp` with config from env vars (`VITE_FIREBASE_*`).
- Exports `auth` (for login) and `db` (for Firestore).
- **Purpose:** Connects the frontend to Firebase so we can sign users in and read/write Firestore.

### login.jsx
- Form: email, password, Sign In button.
- Calls `signInWithEmailAndPassword(auth, email, password)` from Firebase Auth.
- **Purpose:** Logs the user in. Firebase handles passwords; we don’t store them.

### App.jsx — The Router
- **onAuthStateChanged** — Firebase listener. Fires when login state changes (signed in, signed out).
- **getIdTokenResult()** — Gets the user’s JWT. It has **custom claims** (e.g. `role: "facility_engineer"`).
- **Flow:**
  1. No user → show `Login`
  2. User but no valid role → show `Unauthorized`
  3. User + valid role → show the right dashboard (`FacilityEngineer`, `SustainabilityDirector`, or `Auditor`)
- **CVD toggle** — Color vision deficiency modes. Adds a class to `<html>` (e.g. `cvd-deuteranopia`) so `index.css` remaps colors. Saves choice in `localStorage`.
- **Purpose:** Decides what the user sees based on auth and role.

---

## Part 3: Frontend Pages

### FacilityEngineer.jsx
- **Tabs:** Run Analysis, Revisions, History.
- **Run Analysis:** Loads facilities from Firestore `facility_profiles`, user picks one, adds notes, clicks Run. Calls `streamRun()` from `api.js` to hit `POST /run`. Shows SSE events (started, running, finished).
- **Revisions:** Uses `onSnapshot` on `proposals` to get live updates. Shows facilities where Director requested revision. Engineer can add notes and re-run.
- **History:** Shows approved/rejected proposals.
- **Purpose:** Engineer runs analyses and handles revision requests.

### SustainabilityDirector.jsx
- **Query:** `proposals` where `status == 'pending_review'`.
- **onSnapshot** — Firestore real-time listener. List updates automatically when data changes.
- **Queue:** One card per facility (latest proposal only). Sorted by urgency. Click card → detail panel.
- **Detail panel:** Facility context, energy load, battery sizing, financials. Approve / Reject / Request Revision.
- **submitDecision()** — Calls `POST /proposals/{runId}/decision` with status and feedback.
- **Purpose:** Director reviews proposals and makes decisions.

### Auditor.jsx
- Loads `agent_decisions` and `proposals` from Firestore.
- **KPI cards:** Counts (total proposals, pending, approved, etc.).
- **Audit trail:** List of agent decisions, filterable. Expand to see JSON.
- **Purpose:** Read-only view of all agent activity for compliance.

### Unauthorized.jsx
- Shown when user is signed in but has no role (or invalid role). Tells them to contact admin.
- **Purpose:** Handles users who shouldn’t see any dashboard.

---

## Part 4: Frontend API Layer

### api.js
- **streamRun()** — Calls `POST /run` with `fetch`, reads the response as a stream. Parses SSE format (`data: {...}\n\n`), calls `onEvent` for each JSON chunk. **Why not EventSource?** EventSource only supports GET; our endpoint needs POST (body with facility_id).
- **submitDecision()** — `POST /proposals/{runId}/decision` with status and feedback. Sends `Authorization: Bearer <token>`.
- **Purpose:** Talks to the backend. All API calls go through here.

---

## Part 5: Styling

### index.css
- **:root** — CSS variables for colors (e.g. `--c-red`, `--c-teal`) and fonts. Columbus/Cummins theme.
- **CVD classes** — `.cvd-deuteranopia`, `.cvd-protanopia`, etc. Override those variables so colors work for colorblind users.
- **Purpose:** Global design tokens. Components use `var(--c-red)` etc.

### App.css
- Styles for navbar, pages, cards, forms, buttons, login, etc.
- **Purpose:** All component-specific styles.

---

## Part 6: Backend — main.py

### FastAPI
- **FastAPI** — Python web framework. Defines routes (URLs) and handlers.
- **CORS** — Allows the frontend (different origin) to call the API.
- **dotenv** — Loads `.env` for secrets (e.g. `SERVICE_ACCOUNT_PATH`, `OPENROUTER_API_KEY`).

### Firebase Admin
- **firebase_admin** — Server-side Firebase SDK. Uses a **service account** (JSON key file) to authenticate.
- **auth.verify_id_token(token)** — Validates the JWT from the frontend. Returns decoded claims (uid, email, role).
- **Purpose:** Backend can trust who the user is.

### Endpoints

| Endpoint | Who | Purpose |
|----------|-----|---------|
| `GET /ping` | Anyone | Health check |
| `POST /run` | Engineer, Director | Runs the graph, streams SSE events |
| `POST /proposals/{run_id}/decision` | Director only | Approve/reject/revision |
| `POST /test-graph` | (dev) | Run graph without streaming |
| `POST /setup-roles` | (dev) | Set custom claims on test users |

### /run flow
1. Verify token, check role.
2. Yield SSE: `{"stage": "started"}`
3. Call `app_graph.invoke()` with initial state. Graph runs synchronously.
4. Yield SSE: `{"stage": "finished", "run_id": ..., "status": ...}`
5. If error: `{"stage": "error", "error": "..."}`

### /proposals/{run_id}/decision flow
1. Verify token, must be Director.
2. Call `proposal_update_decision()` to update Firestore.
3. Return `{"ok": true}`.

---

## Part 7: Backend — firestore_tools.py

**Firestore** — NoSQL document database. Collections hold documents. Each document has an ID and key-value fields.

### Collections

| Collection | Purpose |
|------------|---------|
| `facility_profiles` | One doc per facility. Power load, diesel hours, IRA eligibility, climate, etc. |
| `proposals` | One doc per run. Status (created, running, pending_review, approved, rejected, etc.), proposal_json, urgency_score. |
| `agent_decisions` | Append-only log. Each agent writes a record: run_id, agent_name, output_json, confidence, rationale. |
| `checkpoints` | LangGraph state. One doc per thread_id. |

### Key functions

- **facility_profile_get(facility_id)** — Read one facility.
- **proposal_create(facility_id)** — Create a new proposal doc, return run_id.
- **proposal_update(run_id, patch)** — Merge patch into proposal.
- **proposal_save_draft(...)** — Save final proposal as `pending_review`. First calls `proposal_supersede_older_pending` so only the latest run per facility stays pending.
- **proposal_supersede_older_pending(facility_id, keep_run_id)** — Mark all other `pending_review` for that facility as `rejected`. Director only sees one per facility.
- **proposal_update_decision(...)** — When Director approves/rejects, update that proposal. Also calls `proposal_supersede_older_pending` so older pending runs for same facility get rejected.
- **agent_decision_append(...)** — Add a row to `agent_decisions` for audit.

---

## Part 8: Backend — graph.py (The AI Pipeline)

### LangGraph
- **LangGraph** — Library for building agent workflows. You define a graph of nodes (functions) and edges. State flows through the graph.
- **StateGraph(AgentState)** — The graph’s state is a dict (AgentState) that gets passed from node to node.
- **Checkpointer** — Saves state to Firestore so runs can be resumed. We use `FirestoreCheckpointer`.

### AgentState (TypedDict)
- `facility_id`, `run_id`, `facility_profile`, `energy_load_output`, `battery_sizing_output`, `human_feedback`, `final_proposal`
- `status`, `disqualified`, `disqualifier_reason`
- `ira_credit_flag`, `nmc_recommended_flag`, `priority_tier`

### OpenRouter + OpenAI client
- **OpenRouter** — API gateway. Lets you call many LLM providers with one interface.
- We use `OpenAI` client with `base_url="https://openrouter.ai/api/v1"` so it talks to OpenRouter.
- **Model:** `liquid/lfm-2.5-1.2b-thinking:free` — Small, fast, has “thinking” tokens (chain-of-thought).

### Graph flow

```
orchestrator → [if disqualified → END] → energy_load_agent → battery_sizing_agent → review_node → END
```

### Orchestrator
1. Load facility from Firestore.
2. Create proposal if needed, set status `running`.
3. **Hard thresholds:** If diesel < 200 hrs, demand < $2k, or load < 100 kW → reject, return (disqualified).
4. Call LLM with facility profile. Get `priority_tier`, `ira_credit_flag`, `nmc_recommended_flag`, `rationale`.
5. **Pydantic** — `OrchestratorOutput` validates the LLM’s JSON. Catches bad shapes.
6. Append to `agent_decisions`.
7. Return state with `disqualified: False`, pass to next node.

### Energy Load Agent
1. Gets facility profile and `nmc_recommended_flag` from state.
2. Calls LLM. Asks for: diesel reduction, peak events, product (BP104E or BP97E), module count, climate risk.
3. Validates with `EnergyLoadOutput`.
4. Appends to `agent_decisions`.
5. Returns state with `energy_load_output`.

### Battery Sizing Agent
1. Gets facility, energy_load_output, `ira_credit_flag`.
2. Calls LLM. Asks for: 3 scenarios (continue, upgrade diesel, add battery), CapEx, IRA credit, payback, NPV, CO₂.
3. Validates with `BatterySizingOutput`.
4. Appends to `agent_decisions`.
5. Returns state with `battery_sizing_output`.

### Review Node
1. Builds `final_proposal` from all agent outputs.
2. Calls `proposal_save_draft()` — saves to Firestore as `pending_review`, supersedes older pending for same facility.
3. Appends to `agent_decisions`.
4. Returns. Graph ends. Human takes over.

### extract_json()
- LLMs sometimes wrap JSON in `<think>...</think>` or markdown. This strips that and parses the JSON object.

---

## Part 9: Backend — checkpointer.py

- **BaseCheckpointSaver** — LangGraph interface for saving/loading state.
- **put()** — Saves checkpoint to Firestore `checkpoints/{thread_id}`. Uses `json.dumps(..., default=str)` for Firestore timestamps.
- **get_tuple()** — Loads checkpoint. Returns `CheckpointTuple` so LangGraph can resume.
- **Purpose:** Persist graph state. If the process crashes, we could resume. For our flow we run to completion, but the interface is there.

---

## Part 10: set_claims.py

- Script to set **custom claims** on Firebase users. Claims are key-value pairs stored in the JWT (e.g. `role: "facility_engineer"`).
- Run once per user (or when changing roles). Uses Firebase Admin.
- **Purpose:** Assign roles so App.jsx knows which dashboard to show.

---

## Part 11: Data Flow Summary

1. **Engineer runs analysis:** Frontend calls `POST /run` with facility_id. Backend invokes graph. Orchestrator → Energy Load → Battery Sizing → Review Node. Proposal saved as `pending_review`. SSE streams events to frontend.
2. **Director sees queue:** Frontend listens to `proposals` where `status == 'pending_review'`. One card per facility (latest only). Clicks Approve → `POST /proposals/{id}/decision` → backend marks proposal approved and rejects older pending for same facility.
3. **Auditor sees trail:** Frontend reads `agent_decisions`. Every agent write is there.

---

## Part 12: Tech Stack Cheat Sheet

| Tech | Purpose |
|------|---------|
| **React** | UI library. Components, state, re-renders. |
| **Vite** | Build tool. Dev server, bundling, fast HMR. |
| **Firebase Auth** | Login. Email/password, JWT with custom claims. |
| **Firestore** | Database. Real-time listeners, collections, documents. |
| **FastAPI** | Backend framework. Routes, validation, async. |
| **LangGraph** | Agent orchestration. Graph of nodes, state flow. |
| **OpenRouter** | LLM API. We use liquid/lfm-2.5-1.2b-thinking. |
| **Pydantic** | Validation. Ensures LLM output matches expected schema. |
| **SSE (Server-Sent Events)** | Stream text from server. Format: `data: {...}\n\n`. |

---

# Quiz

Answer these. If you miss any, re-read the guide and try again.

## Round 1: Basics

1. What does `onAuthStateChanged` do?
2. Where does the user’s role come from?
3. What is Firestore?
4. What is the purpose of `api.js`?

## Round 2: Flow

5. When the Engineer clicks Run Analysis, what HTTP request is made?
6. What does the backend do when it receives that request?
7. Name the three agents in order.
8. What does the Review Node do?

## Round 3: Data

9. What collection holds facility data (power load, diesel hours, etc.)?
10. What collection holds the audit trail of every agent decision?
11. When the Director approves a proposal, what happens to older pending proposals for the same facility?

## Round 4: Tech

12. What is OpenRouter and why do we use it?
13. What is LangGraph?
14. Why does `streamRun` use `fetch` + `ReadableStream` instead of `EventSource`?
15. What does the CVD toggle do?

## Round 5: Details

16. What are the Orchestrator’s three hard disqualifier thresholds?
17. What does `proposal_supersede_older_pending` do?
18. What is a custom claim?
19. What model do we use for the LLM?
20. What does Pydantic do in the graph?

---

*Answers are in CODEBASE_QUIZ_ANSWERS.md. Don’t peek until you’ve tried!*
