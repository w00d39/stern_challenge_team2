from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional

from firestore_tools import (
    facility_get,
    case_create,
    case_update,
    hitl_create,
    audit_append,
)


class AgentState(TypedDict):
    facility_id: str
    case_id: Optional[str]
    hitl_ticket_id: Optional[str]

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

    # Load facility profile from Firestore
    profile = facility_get(facility_id) or {}

    # Ensure case exists
    case_id = state.get("case_id")
    if not case_id:
        case_id = case_create(facility_id)

    # Save progress to Firestore
    case_update(case_id, {"status": "running"})

    audit_append(
        case_id,
        "orchestrator",
        "init",
        f"facility_id={facility_id}",
        f"facility_found={bool(profile)}",
        "Loaded facility_profile and ensured case record exists.",
    )

    # Hard disqualifiers
    if profile.get("annual_diesel_runtime_hours", 0) < 200:
        reason = "Emergency-Only — Low Priority"
        case_update(case_id, {"status": "disqualified", "disqualifier_reason": reason})
        audit_append(
            case_id,
            "orchestrator",
            "disqualify",
            "annual_diesel_runtime_hours<200",
            reason,
            "Below minimum diesel runtime threshold.",
        )
        return {
            **state,
            "case_id": case_id,
            "facility_profile": profile,
            "disqualified": True,
            "disqualifier_reason": reason,
            "status": "disqualified",
        }

    if profile.get("monthly_demand_charge_usd", 0) < 2000:
        reason = "Low Demand Charge — Monitor"
        case_update(case_id, {"status": "disqualified", "disqualifier_reason": reason})
        audit_append(
            case_id,
            "orchestrator",
            "disqualify",
            "monthly_demand_charge_usd<2000",
            reason,
            "Below minimum demand charge threshold.",
        )
        return {
            **state,
            "case_id": case_id,
            "facility_profile": profile,
            "disqualified": True,
            "disqualifier_reason": reason,
            "status": "disqualified",
        }

    if profile.get("facility_power_load_kw", 0) < 100:
        reason = "Below Minimum Scale"
        case_update(case_id, {"status": "disqualified", "disqualifier_reason": reason})
        audit_append(
            case_id,
            "orchestrator",
            "disqualify",
            "facility_power_load_kw<100",
            reason,
            "Below minimum facility load threshold.",
        )
        return {
            **state,
            "case_id": case_id,
            "facility_profile": profile,
            "disqualified": True,
            "disqualifier_reason": reason,
            "status": "disqualified",
        }

    # Qualified: continue
    case_update(case_id, {"status": "routing"})
    audit_append(
        case_id,
        "orchestrator",
        "route",
        "passed hard disqualifiers",
        "next=energy_load_agent",
        "Meets minimum thresholds; proceed to analysis.",
    )

    return {
        **state,
        "case_id": case_id,
        "facility_profile": profile,  # important: keep in state for HITL context
        "disqualified": False,
        "status": "routing",
    }


def energy_load_agent(state: AgentState) -> AgentState:
    print("Energy Load Agent running...")
    # Placeholder
    return {
        **state,
        "energy_load_output": {"status": "complete"},
        "status": "energy_load_done",
    }


def battery_sizing_agent(state: AgentState) -> AgentState:
    print("Battery Sizing Agent running...")
    # Placeholder
    return {
        **state,
        "battery_sizing_output": {"status": "complete"},
        "status": "battery_sizing_done",
    }


def hitl_node(state: AgentState) -> AgentState:
    print("HITL node creating ticket...")

    case_id = state.get("case_id")
    if not case_id:
        case_id = case_create(state["facility_id"])

    ticket_id = hitl_create(
        case_id=case_id,
        question="Approve assumptions and proceed?",
        context={
            "facility_id": state["facility_id"],
            "facility_profile": state.get("facility_profile"),
            "energy_load_output": state.get("energy_load_output"),
            "battery_sizing_output": state.get("battery_sizing_output"),
        },
        options=["approve", "revise", "reject"],
    )

    case_update(case_id, {"status": "paused_for_review"})
    audit_append(
        case_id,
        "hitl_node",
        "hitl_created",
        "create review ticket",
        f"ticket_id={ticket_id}",
        "Human approval required before finalizing recommendation.",
    )

    return {
        **state,
        "case_id": case_id,
        "hitl_ticket_id": ticket_id,
        "status": "pending_review",
    }


def route_after_orchestrator(state: AgentState) -> str:
    return "end" if state["disqualified"] else "energy_load_agent"


def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("orchestrator", orchestrator)
    graph.add_node("energy_load_agent", energy_load_agent)
    graph.add_node("battery_sizing_agent", battery_sizing_agent)
    graph.add_node("hitl_node", hitl_node)

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
    graph.add_edge("battery_sizing_agent", "hitl_node")
    graph.add_edge("hitl_node", END)

    return graph.compile()


app_graph = build_graph()