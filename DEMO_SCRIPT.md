# Destination Zero Dashboard — 2-Minute Read-Aloud Script

*Read this while you demo. For the live presentation you'll know it by heart.*

---

## Script (~2 min)

**[Sign in as Engineer. Select a facility. Click Run Analysis.]**

"I'm the Facility Engineer. I pick a facility, add any context, and run the analysis. You'll see events stream in real time — the backend is running the three agents: Orchestrator, Energy Load, and Battery Sizing. When it finishes, the proposal goes to the Director's queue."

**[While it runs: sign out, sign in as Director. Use any of these to fill time:]**

"The Orchestrator evaluates the facility and sets priority tier — HIGH, MEDIUM, or MONITOR. The Energy Load Agent sizes the product and estimates diesel reduction. The Battery Sizing Agent models the financials — three scenarios, CapEx, payback, NPV. Each agent logs to Firestore for audit."

"While that runs, I'll switch to the Director view. We use role-based routing — Firebase custom claims — so each user sees a different dashboard."

"The Director's queue updates in real time via Firestore listeners. No refresh needed. When the analysis finishes, the proposal will appear here."

**[Click a facility card. Scroll through the detail panel.]**

"As Director, I see the queue with priority badges and IRA eligibility. I select a facility. Here's the full proposal: facility profile, energy load analysis, battery sizing, and the financial model — three scenarios, payback, NPV, CO₂ avoided. I approve, reject, or request a revision with feedback. Human-in-the-loop."

**[Optional: Switch to Auditor. Show audit trail.]**

"The Auditor sees every agent decision — who ran what, confidence, rationale, full output. All logged to Firestore for compliance."

**[Close]**

"Stack: React, Vite, FastAPI, LangGraph, Firebase. We use OpenRouter with a small thinking model for the agents. There's also a CVD mode toggle in the navbar for colorblind users. That's the Destination Zero Dashboard."

---

## Pre-Demo

- One facility with a pending proposal (run as Engineer first if needed)
- Engineer + Director accounts ready
- Backend + frontend running

## If It Breaks

"The flow is: Engineer runs analysis, Director reviews, Auditor sees the trail. I can walk through the code."
