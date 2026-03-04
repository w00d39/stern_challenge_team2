# Team 2 Backend

Backend for the Cummins / Accelera facility decarbonization workflow.

This service supports:
- seeding synthetic facility profiles
- running the analysis graph for a facility
- storing proposal outputs in Firestore
- storing agent audit logs in Firestore
- director review actions on proposals
- Firebase token verification and role-based access control
- deployment on Render

---

## Current backend architecture

### Firestore collections

The backend now uses these collections:

- `facility_profiles`
- `proposals`
- `agent_decisions`
- `checkpoints`

### Collection rename summary

Old names:
- `facilities`
- `cases`
- `audit_logs`
- `hitl_tickets`

New names:
- `facility_profiles`
- `proposals`
- `agent_decisions`

`hitl_tickets` is no longer used. Review state is now stored directly in `proposals`.

---

## Firestore schema

### `facility_profiles`

Document ID = `facility_id`

Common fields:
- `name`
- `annual_diesel_runtime_hours`
- `monthly_demand_charge_usd`
- `facility_power_load_kw`
- `updated_at`
- `ira_eligible`
- `climate_zone`
- `grid_carbon_intensity_lbs_kwh`
- `esg_mandate`
- `annual_diesel_fuel_cost`
- `grid_electricity_rate_kwh`
- `existing_solar_kw`
- `monthly_grid_outage_count`
- `maintenance_contract_status`
- `facility_type`

Some facility documents may also include extra fields such as `state`.

### `proposals`

Document ID = `run_id`

Common fields:
- `run_id`
- `facility_id`
- `status`
- `created_at`
- `updated_at`
- `reviewed_at`
- `reviewer_uid`
- `feedback_text`
- `revision_count`
- `urgency_score`
- `proposal_json`

Expected status values:
- `pending_review`
- `revision_requested`
- `approved`
- `rejected`

### `agent_decisions`

Append-only audit log.

Common fields:
- `run_id`
- `facility_id`
- `agent_name`
- `input_summary`
- `output_json`
- `confidence`
- `rationale`
- `timestamp`

### `checkpoints`

Used by LangGraph checkpointing. No schema change was made here.

---

## Backend endpoints

### Health / test endpoints

#### `GET /ping`
Returns:
```json
{"status":"ok"}