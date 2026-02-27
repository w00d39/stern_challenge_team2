from langgraph.graph import StateGraph, END
from checkpointer import FirestoreCheckpointer
from typing import TypedDict, Optional


class AgentState(TypedDict):
    facility_id: str
    facility_profile: Optional[dict]
    energy_load_output: Optional[dict]
    battery_sizing_output: Optional[dict]
    human_feedback: Optional[str]
    final_proposal: Optional[dict]
    status: str
    disqualified: bool
    disqualifier_reason: Optional[str]


def orchestrator(state: AgentState) -> AgentState:
    print(f"Orchestrator running for {state['facility_id']}")
    
    profile = state.get("facility_profile", {})
    
    # Hard disqualifiers
    if profile.get("annual_diesel_runtime_hours", 0) < 200:
        return {**state, "disqualified": True, "disqualifier_reason": "Emergency-Only — Low Priority", "status": "disqualified"}
    
    if profile.get("monthly_demand_charge_usd", 0) < 2000:
        return {**state, "disqualified": True, "disqualifier_reason": "Low Demand Charge — Monitor", "status": "disqualified"}
    
    if profile.get("facility_power_load_kw", 0) < 100:
        return {**state, "disqualified": True, "disqualifier_reason": "Below Minimum Scale", "status": "disqualified"}
    
    return {**state, "disqualified": False, "status": "routing"}

def energy_load_agent(state: AgentState) -> AgentState:
    print("Energy Load Agent running...")
    # Placeholder — full logic in Week 2
    return {**state, "energy_load_output": {"status": "complete"}, "status": "energy_load_done"}

def battery_sizing_agent(state: AgentState) -> AgentState:
    print("Battery Sizing Agent running...")
    # Placeholder — full logic in Week 2
    return {**state, "battery_sizing_output": {"status": "complete"}, "status": "battery_sizing_done"}

def hitl_node(state: AgentState) -> AgentState:
    print("HITL interrupt firing...")
    return {**state, "status": "pending_review"}


def route_after_orchestrator(state: AgentState) -> str:
    if state["disqualified"]:
        return "end"
    return "energy_load_agent"


def build_graph():
    graph = StateGraph(AgentState)
    
    graph.add_node("orchestrator", orchestrator)
    graph.add_node("energy_load_agent", energy_load_agent)
    graph.add_node("battery_sizing_agent", battery_sizing_agent)
    graph.add_node("hitl_node", hitl_node)
    
    graph.set_entry_point("orchestrator")
    
    graph.add_conditional_edges("orchestrator", route_after_orchestrator, {
        "energy_load_agent": "energy_load_agent",
        "end": END
    })
    
    graph.add_edge("energy_load_agent", "battery_sizing_agent")
    graph.add_edge("battery_sizing_agent", "hitl_node")
    graph.add_edge("hitl_node", END)
    
    checkpointer =FirestoreCheckpointer()
    return graph.compile(checkpointer=checkpointer, interrupt_before=["hitl_node"])

app_graph = build_graph()