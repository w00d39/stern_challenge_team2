from firestore_tools import (
    facility_upsert, facility_get,
    case_create, case_get, case_update,
    hitl_create, hitl_list_open, hitl_resolve,
    audit_append
)

facility_id = "demo_facility"
facility_upsert(facility_id, {"name": "Demo Facility"})
print("facility:", facility_get(facility_id))

case_id = case_create(facility_id)
print("case:", case_get(case_id))

case_update(case_id, {"status": "running"})
audit_append(case_id, "orchestrator", "status_update", "created", "running", "smoke")

ticket_id = hitl_create(case_id, "Approve assumptions?", {"foo": "bar"}, ["approve", "revise", "reject"])
print("open tickets:", hitl_list_open(case_id))

hitl_resolve(ticket_id, "approve", "looks good", "nav")
print("open tickets after resolve:", hitl_list_open(case_id))