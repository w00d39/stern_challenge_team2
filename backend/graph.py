from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional, Dict, Any
from openai import OpenAI
import os, json

from firestore_tools import (
    facility_profile_get,
    proposal_create,
    proposal_update,
    proposal_save_draft,
    agent_decision_append,
)


# OpenAI client for OpenRouter to initialize for later purposes
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)

ORCHESTRATOR_SYSTEM_PROMPT = """ 
You are the Battery Transition Orchestrator for Cummins Inc.'s internal
Accelera Battery System Decision Tool

Cummins has committed to reducing absolute Scope 1 and Scope 2 greenhouse
gas emissions from its own facilities and operations by 2030 under its Destination
Zero strategy. As of 2023, Cummins has achieved a 31% reduction. The remaining 
reductions require capital decisions at the facility level; including transitioning
diesel backup generator runtime to Accelera battery energy storage systems (BESS).

Your role is to evaluate a Cummins facility profile and determine:
1. The facility's priority tier for Accelera BESS deployment
2. Which routing flags to pass to downstream agents
3. A plain-English rationale grounded in Destination Zero context

Piority tiers:
- HIGH: Strong financial case AND meaningful Scope 1 reduction potential.
- MEDIUM: Viable case but marginal on one or more dimensions. Worth analyzing but not urgent.
- MONITOR: Passes minimum thresholds but weak overall case. Revisit in 12 months.

Routing flags you may set:
- IRA_CREDIT_FLAG: true if ira_eligible = true. Instructs Battery Sizing 
  Agent to apply 30% ITC to CapEx calculation.
- NMC_RECOMMENDED: true if climate_zone = extreme_cold. Instructs Energy 
  Load Agent to recommend BP97E instead of BP104E.

You must respond with a JSON object and NOTHING else. No explanation 
outside the JSON.

{
  "priority_tier": "HIGH" | "MEDIUM" | "MONITOR",
  "ira_credit_flag": true | false,
  "nmc_recommended_flag": true | false,
  "confidence": "high" | "medium" | "low",
  "rationale": 
  "2-3 sentences grounded in Destination Zero context. Reference specific facility fields. Explain why this facility does or does not represent a strong decarbonization opportunity for Cummins."
}

"""


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

    #priority_tier helps with sorting now and later on
    #ira is for battery agent to get that tax credit if applicable
    #nmc = product trigger flag for reccomended product in ELA
    ira_credit_flag: Optional[bool]
    nmc_recommended_flag: Optional[bool]
    priority_tier: Optional[str]


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

    # LLM call for priority tier and routing flags
    user_message = f""" 
    Evaluate this Cummins facility for Accelera BESS deployment priority
    under the Destination Zero strategy.

    Facility Profile:
    {json.dumps(profile, indent=2)}

    Determine priority tier, routing flags, confidence, and rationale.
    """
    # Orchestrator Agent
    try:
        response = client.chat.completions.create(
            model = "liquid/lfm-2.5-1.2b-thinking:free",
            messages = [
                {"role": "system", "content": ORCHESTRATOR_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature = 0.2,
        )
        raw = response.choices[0].message.content.strip()
        #just in case the LLM wraps the JSON in ```
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startsswith("json"):
                raw = raw[4:]
        llm_output = json.loads(raw)
    except Exception as e:
        #default to monitor if LLM error occurs so it doesn't freeze
        print(f"Orchestrator LLM error: {e}")
        llm_output = {
            "priority_tier": "MONITOR",
            "ira_credit_flag": False,
            "nmc_recommended_flag": False,
            "confidence": "low",
            "rationale": "LLM error; default to monitor.",
        }
    

    proposal_update(run_id, {"status": "routing"})
    agent_decision_append(
        run_id=run_id,
        facility_id=facility_id,
        agent_name="orchestrator",
        input_summary=f"passed hard disqualifiers. Facility: {profile.get('name', facility_id)}",
        output_json= llm_output,
        confidence= llm_output.get("confidence", "medium"),
        rationale= llm_output.get("rationale", ""),
    )

    return {
        **state,
        "run_id": run_id,
        "facility_profile": profile,
        "disqualified": False,
        "status": "routing",
        "ira_credit_flag": llm_output.get("ira_credit_flag", False),
        "nmc_recommended_flag": llm_output.get("nmc_recommended_flag", False),
        "priority_tier": llm_output.get("priority_tier", "MONITOR"),
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