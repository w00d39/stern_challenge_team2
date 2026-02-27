from graph import app_graph

if __name__ == "__main__":
    facility_id = "demo_facility"

    init_state = {
        "facility_id": facility_id,
        "facility_profile": None,
        "energy_load_output": None,
        "battery_sizing_output": None,
        "human_feedback": None,
        "final_proposal": None,
        "status": "created",
        "disqualified": False,
        "disqualifier_reason": None,
    }

    out = app_graph.invoke(init_state)
    print(out)