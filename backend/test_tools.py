from firestore_tools import (
    facility_profile_upsert,
    facility_profile_get,
    proposal_create,
    proposal_get,
    proposal_update,
    proposal_save_draft,
    proposal_list_pending,
    proposal_update_decision,
    agent_decision_append,
)

facility_id = "demo_facility"

facility_profile_upsert(
    facility_id,
    {
        "name": "Demo Facility",
        "annual_diesel_runtime_hours": 400,
        "monthly_demand_charge_usd": 5000,
        "facility_power_load_kw": 250,
        "ira_eligible": False,
        "climate_zone": "",
        "grid_carbon_intensity_lbs_kwh": 0,
        "esg_mandate": False,
        "annual_diesel_fuel_cost": 0,
        "grid_electricity_rate_kwh": 0,
        "existing_solar_kw": 0,
        "monthly_grid_outage_count": 0,
        "maintenance_contract_status": "",
        "facility_type": "",
    },
)
print("facility_profile:", facility_profile_get(facility_id))

run_id = proposal_create(facility_id)
print("proposal after create:", proposal_get(run_id))

proposal_update(run_id, {"status": "running"})
print("proposal after status update:", proposal_get(run_id))

agent_decision_append(
    run_id=run_id,
    facility_id=facility_id,
    agent_name="orchestrator",
    input_summary="created proposal for smoke test",
    output_json={"status": "running"},
    confidence="high",
    rationale="Smoke test write to agent_decisions.",
)

proposal_save_draft(
    run_id=run_id,
    facility_id=facility_id,
    proposal_json={
        "facility_id": facility_id,
        "recommendation_status": "draft_ready",
    },
    urgency_score=5,
)
print("proposal after draft save:", proposal_get(run_id))

print("pending proposals:", proposal_list_pending())

proposal_update_decision(
    run_id=run_id,
    status="approved",
    reviewer_uid="nav",
    feedback_text="looks good",
)
print("proposal after decision:", proposal_get(run_id))