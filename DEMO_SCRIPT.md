# Destination Zero Dashboard — 3-Minute Demo Script

*Punchy, judge-friendly. Flow: Engineer → Director (revision) → Engineer (re-run) → Director (approve) → Auditor → CVD.*

---

## Script (~3 min)

**[Sign in as Engineer. Select a facility. Leave Engineer Notes empty. Click Run Analysis.]**

"Cummins has committed to cutting Scope 1 and 2 emissions by 2030 under Destination Zero. The remaining reductions require capital decisions at the facility level — which sites get battery storage first. That's what this dashboard does: it turns facility data into structured, auditable proposals so Directors can make informed decisions fast."

"I'm the Facility Engineer. I pick a facility and run the analysis — no extra context yet. You're watching three AI agents stream in real time: Orchestrator, Energy Load, and Battery Sizing. Each one logs its reasoning to Firestore. That audit trail is critical for ESG reporting."

**[Wait for analysis to finish. Sign out, sign in as Director.]**

"The Director's queue updates in real time via Firestore listeners. No refresh. The proposal appears here automatically. I select it. Here's the full output: facility profile, energy load analysis, battery sizing, three-scenario financial model — CapEx, payback, NPV, CO₂ avoided. Human-in-the-loop: the AI proposes, the human decides. Capital decisions stay with leadership."

**[Request Revision. Enter sensible feedback, e.g.: "Prioritize peak shaving over demand charge reduction. Re-run the financials with that focus." Submit.]**

"I'm not satisfied with this pass. I request a revision with feedback. That feedback goes back to the Engineer — and more importantly, it gets fed into the next analysis run. The AI will see it."

**[Sign out, sign in as Engineer. Go to Revisions tab.]**

"Back to the Engineer. The Revisions tab shows facilities where the Director asked for changes. See — the Director's feedback is right here. I don't have to retype it. I click Re-run, and that feedback becomes the additional context the agents receive. The AI literally gets the Director's notes and adjusts its analysis."

**[Re-run. Wait for it to finish. Sign out, sign in as Director.]**

"The queue updates. The new proposal is here. I review the revised output — the agents have incorporated the feedback. I approve."

**[Approve the proposal.]**

"Done. That's the full cycle: run, revise, re-run with feedback, approve. Real human oversight, real traceability."

**[Sign out, sign in as Auditor.]**

"The Auditor sees every agent decision — who ran what, when, confidence, rationale, full output. All logged to Firestore. When someone asks 'why did we approve this facility?' we can show the full chain of reasoning. Compliance and ESG reporting."

**[Back to Engineer or Director. Open CVD toggle in navbar.]**

"One more thing: the navbar has a color vision mode toggle. Five palettes — deuteranopia, protanopia, tritanopia, high contrast. We built this for accessibility. When you're rolling out tools to engineers and directors across facilities, colorblind users need to read the same charts and badges. The whole UI recolors instantly. That's the Destination Zero Dashboard."

---

## Pre-Demo

- Engineer + Director + Auditor accounts ready
- Backend + frontend running
- Pick a facility that will complete without disqualification (e.g. Florence FAC-012)

## If It Breaks

"The flow is: Engineer runs, Director revises, Engineer re-runs with feedback, Director approves, Auditor sees the trail. I can walk through the code."
