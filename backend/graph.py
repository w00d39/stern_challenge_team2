from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional, Dict, Any

from firestore_tools import (
    facility_profile_get,
    proposal_create,
    proposal_update,
    proposal_save_draft,
    agent_decision_append,
)


class AgentState(TypedDict):
    facility_id: str
    run_id: Optional[str]

    facility_profile: Optional[dict]
    energy_load_output: Optional[dict]
    battery_sizing_output: Optional[dict]
    human_feedback: Optional[str]
    final_proposal: Optional[dict]

    status: str
    disqualified: bool
    disqualifier_reason: Optional[str]


def orchestrator(state: AgentState) -> AgentState:
    facility_id = state["facility_id"]
    print(f"Orchestrator running for {facility_id}")

    profile = facility_profile_get(facility_id) or {}

    run_id = state.get("run_id")
    if not run_id:
        run_id = proposal_create(facility_id)

    proposal_update(run_id, {"status": "running"})

    agent_decision_append(
        run_id=run_id,
        facility_id=facility_id,
        agent_name="orchestrator",
        input_summary=f"facility_id={facility_id}",
        output_json={"facility_found": bool(profile)},
        confidence="high",
        rationale="Loaded facility_profile and ensured proposal record exists.",
    )

    if profile.get("annual_diesel_runtime_hours", 0) < 200:
        reason = "Emergency-Only — Low Priority"
        proposal_update(
            run_id,
            {
                "status": "rejected",
                "feedback_text": reason,
            },
        )
        agent_decision_append(
            run_id=run_id,
            facility_id=facility_id,
            agent_name="orchestrator",
            input_summary="annual_diesel_runtime_hours<200",
            output_json={"disqualified": True, "reason": reason},
            confidence="high",
            rationale="Below minimum diesel runtime threshold.",
        )
        return {
            **state,
            "run_id": run_id,
            "facility_profile": profile,
            "disqualified": True,
            "disqualifier_reason": reason,
            "status": "disqualified",
        }

    if profile.get("monthly_demand_charge_usd", 0) < 2000:
        reason = "Low Demand Charge — Monitor"
        proposal_update(
            run_id,
            {
                "status": "rejected",
                "feedback_text": reason,
            },
        )
        agent_decision_append(
            run_id=run_id,
            facility_id=facility_id,
            agent_name="orchestrator",
            input_summary="monthly_demand_charge_usd<2000",
            output_json={"disqualified": True, "reason": reason},
            confidence="high",
            rationale="Below minimum demand charge threshold.",
        )
        return {
            **state,
            "run_id": run_id,
            "facility_profile": profile,
            "disqualified": True,
            "disqualifier_reason": reason,
            "status": "disqualified",
        }

    if profile.get("facility_power_load_kw", 0) < 100:
        reason = "Below Minimum Scale"
        proposal_update(
            run_id,
            {
                "status": "rejected",
                "feedback_text": reason,
            },
        )
        agent_decision_append(
            run_id=run_id,
            facility_id=facility_id,
            agent_name="orchestrator",
            input_summary="facility_power_load_kw<100",
            output_json={"disqualified": True, "reason": reason},
            confidence="high",
            rationale="Below minimum facility load threshold.",
        )
        return {
            **state,
            "run_id": run_id,
            "facility_profile": profile,
            "disqualified": True,
            "disqualifier_reason": reason,
            "status": "disqualified",
        }

    proposal_update(run_id, {"status": "routing"})
    agent_decision_append(
        run_id=run_id,
        facility_id=facility_id,
        agent_name="orchestrator",
        input_summary="passed hard disqualifiers",
        output_json={"next": "energy_load_agent"},
        confidence="high",
        rationale="Meets minimum thresholds; proceed to analysis.",
    )

    return {
        **state,
        "run_id": run_id,
        "facility_profile": profile,
        "disqualified": False,
        "status": "routing",
    }


def energy_load_agent(state: AgentState) -> AgentState:
    print("Energy Load Agent running...")

    output = {"status": "complete"}

    agent_decision_append(
        run_id=state["run_id"],
        facility_id=state["facility_id"],
        agent_name="energy_load_agent",
        input_summary="Generated placeholder energy load analysis output.",
        output_json=output,
        confidence="medium",
        rationale="Current implementation is a placeholder agent.",
    )

    return {
        **state,
        "energy_load_output": output,
        "status": "energy_load_done",
    }


def battery_sizing_agent(state: AgentState) -> AgentState:
    print("Battery Sizing Agent running...")

    output = {"status": "complete"}

    agent_decision_append(
        run_id=state["run_id"],
        facility_id=state["facility_id"],
        agent_name="battery_sizing_agent",
        input_summary="Generated placeholder battery sizing output.",
        output_json=output,
        confidence="medium",
        rationale="Current implementation is a placeholder agent.",
    )

    return {
        **state,
        "battery_sizing_output": output,
        "status": "battery_sizing_done",
    }


def build_final_proposal(state: AgentState) -> Dict[str, Any]:
    return {
        "facility_id": state["facility_id"],
        "facility_profile": state.get("facility_profile"),
        "energy_load_output": state.get("energy_load_output"),
        "battery_sizing_output": state.get("battery_sizing_output"),
        "recommendation_status": "draft_ready",
    }


def review_node(state: AgentState) -> AgentState:
    print("Review node saving draft proposal...")

    final_proposal = build_final_proposal(state)

    urgency_score = None
    profile = state.get("facility_profile") or {}
    demand_charge = profile.get("monthly_demand_charge_usd")
    if demand_charge is not None:
        urgency_score = float(demand_charge)

    proposal_save_draft(
        run_id=state["run_id"],
        facility_id=state["facility_id"],
        proposal_json=final_proposal,
        urgency_score=urgency_score,
    )

    agent_decision_append(
        run_id=state["run_id"],
        facility_id=state["facility_id"],
        agent_name="review_node",
        input_summary="Synthesized agent outputs into draft proposal.",
        output_json={"status": "pending_review"},
        confidence="medium",
        rationale="Draft proposal saved and routed for human review.",
    )

    return {
        **state,
        "final_proposal": final_proposal,
        "status": "pending_review",
    }


def route_after_orchestrator(state: AgentState) -> str:
    return "end" if state["disqualified"] else "energy_load_agent"


def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("orchestrator", orchestrator)
    graph.add_node("energy_load_agent", energy_load_agent)
    graph.add_node("battery_sizing_agent", battery_sizing_agent)
    graph.add_node("review_node", review_node)

    graph.set_entry_point("orchestrator")

    graph.add_conditional_edges(
        "orchestrator",
        route_after_orchestrator,
        {
            "energy_load_agent": "energy_load_agent",
            "end": END,
        },
    )

    graph.add_edge("energy_load_agent", "battery_sizing_agent")
    graph.add_edge("battery_sizing_agent", "review_node")
    graph.add_edge("review_node", END)

    return graph.compile()


app_graph = build_graph()