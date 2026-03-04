from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional, Dict, Any
from openai import OpenAI
import os, json, re

from firestore_tools import (
    facility_profile_get,
    proposal_create,
    proposal_update,
    proposal_save_draft,
    agent_decision_append,
)

LLM_MODEL = "liquid/lfm-2.5-1.2b-thinking:free"

# OpenAI client for OpenRouter to initialize for later purposes
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)


def extract_json(raw: str) -> dict:
    """Extract a JSON object from LLM output, handling thinking tokens,
    markdown fences, and other preamble text."""
    # Strip thinking tokens (<think>...</think>)
    if "</think>" in raw:
        raw = raw.split("</think>")[-1].strip()
    # Strip markdown code fences
    if "```" in raw:
        parts = raw.split("```")
        for part in parts[1:]:
            cleaned = part.strip()
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            if cleaned.startswith("{"):
                return json.loads(cleaned)
    # Try to find a JSON object directly
    match = re.search(r'\{[\s\S]*\}', raw)
    if match:
        return json.loads(match.group())
    return json.loads(raw)

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

ENERGY_LOAD_SYSTEM_PROMPT = """
You are the Energy Load & Diesel Runtime Agent for CUmmins Inc.'s internal
Accelera Battery System Decision Tool.

Your job is to analyze a Cummins facility's energy profile and determine how much
diesel generator runtime and peak demand events could be handled by an Accelera BESS instead.
You also recommend the correct Accelera product and configuration for the facility. 

Product selection rules:
- Default product: BP104E (LFP chemistry, temperate/hot/coastal climates)
- If nmc_recommended_flag = true: recommend BP97E (NMC chemistry, extreme cold)

Sizing rule of thumb:
- Target enough capacity to cover 4 hours of peak demand
- facility_power_load_kw * 4 = minimum recommended kWh
- Round up to nearest module configuration

Climate risk flag:
- Set to true if climate_zone = extreme_cold OR monthly_grid_outage_count >= 3

You must respond with a JSON object and NOTHING else.

Schema: 
{
     "diesel_runtime_reduction_hrs": <int, estimated annual hours of diesel runtime the BESS would eliminate>,
  "peak_events_addressable_pct": <float 0.0-1.0, fraction of monthly peak demand events the recommended BESS config can handle>,
  "recommended_product": "BP104E" | "BP97E",
  "recommended_module_count": <int, 1 | 2 | 4 | 8>,
  "recommended_kwh_total": <int, total kWh of recommended configuration>,
  "climate_risk_flag": true | false,
  "confidence": "high" | "medium" | "low",
  "rationale": "2-3 sentences. Reference specific facility fields. Explain the sizing decision and any climate considerations."
}
"""

BATTERY_SIZING_SYSTEM_PROMPT = """
You are the Battery Sizing & ROI Agent for Cummins Inc.'s internal Accelera
Battery System Decision Tool.

Your job is to model the financial case for adding an Accelera BESS at a Cummins facility
under its Destination Zero decarbonization strategy. You produce a three-scenario cost compatison and calculate
payback, NPV, and CO2 impact.

Three scenarios to model:
1. continue_as_is: Current annual cost - diesel fuel + demand charges + grid electricity
2. upgrade_diesel: Replace diesel generator with newer unit. Assume 15% fuel efficiency improvement, same demand charges, $180k one-time cost amortized over 10 years
3. add_battery: Add Accelera BESS alongside exisiting diesel. Demand charges reduced by the peak_events_addressable_pct from the Energy Load Agent. 
    Diesel runtime reduced runtime_reduction_hrs from the Energy Load Agent.

IRA Investment Tax Credit:
- If ira_credit_flag = true: apply 30% ITC to gross CapEx
- Gross CapEx estimate: recommended_module_count * $187,500 per module (installed)
- Net CapEx after ITC = gross_capex * 0.70

CO2 calculation:
- Diesel CO2: diesel_runtime_reduction_hrs * average_generator_kw * 0.000293 metric tons per kWh
  (use facility_power_load_kw * 0.6 as average_generator_kw estimate)
- Grid CO2 avoided: use grid_carbon_intensity_lbs_kwh from facility profile converted to metric tons (divided by 2204.6)

NPV calculation (5 year):
- Annual savings = scenario_continue_as_is - scenario_add_battery
- NPV = sum of (annual_savings / (1.08^year)) for years 1-5 minus net_capex

You must respond with a JSON object and NOTHING else. 

Schema:
{
    "scenario_continue_as_is_annual_cost_usd": <int>,
    "scenario_upgrade_diesel_annual_cost_usd": <int>,
    "scenario_add_battery_annual_cost_usd": <int>,
    "gross_capex_usd": <int>,
    "ira_credit_amount_usd": <int, 0 if not eligible>,
    "ira_adjusted_capex_usd": <int>,
    "payback_years": <float>,
    "npv_5yr_usd": <int>,
    "annual_demand_charge_savings_usd": <int>,
    "annual_diesel_cost_eliminated_usd": <int>,
    "co2_avoided_metric_tons_per_year": <float>,
    "confidence": "high" | "medium" | "low",
    "rationale": "2-3 sentences. Reference specific numbers from your calculation. Explain the strength of the business case in the context of Cummins Destination Zero goals."
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

    feedback_block = ""
    if state.get("human_feedback"):
        feedback_block = f"""
    IMPORTANT — The Sustainability Director reviewed a previous analysis of this
    facility and requested revision with the following feedback:
    "{state['human_feedback']}"

    Take this feedback into account when making your assessment. Adjust your
    priority tier, routing flags, and rationale accordingly.
    """

    user_message = f""" 
    Evaluate this Cummins facility for Accelera BESS deployment priority
    under the Destination Zero strategy.

    Facility Profile:
    {json.dumps(profile, indent=2, default=str)}
    {feedback_block}
    Determine priority tier, routing flags, confidence, and rationale.
    """
    # Orchestrator Agent
    try:
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": ORCHESTRATOR_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.2,
        )
        raw = response.choices[0].message.content.strip()
        llm_output = extract_json(raw)
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

    profile = state.get("facility_profile") or {}
    nmc_flag = state.get("nmc_recommended_flag", False)

    feedback_block = ""
    if state.get("human_feedback"):
        feedback_block = f"""
    IMPORTANT — The Sustainability Director reviewed a previous analysis and
    requested revision with the following feedback:
    "{state['human_feedback']}"

    Adjust your energy load analysis, product recommendation, and sizing
    accordingly based on this feedback.
    """

    user_message = f"""
    Analyze this Cummins facility's energy load and diesel runtime profile. 
    Recommend an Accelera BESS configuration to reduce diesel runtime and handle peak demand events.

    Facility profile:
    {json.dumps(profile, indent=2, default=str)}

    NMC recommended flag (extreme cold climate override): {nmc_flag}
    {feedback_block}
    Determine diesel runtime reduction, peak event coverage, product recommendation, module count, 
    climate risk, confidence, and rationale.
    """

    try:
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": ENERGY_LOAD_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.2,
        )
        raw = response.choices[0].message.content.strip()
        llm_output = extract_json(raw)
    except Exception as e:
        print(f"Energy Load Agent LLM error: {e}")
        #fall back. we pull from facility fields directly
        load_kw = profile.get("facility_power_load_kw", 500)
        runtime = profile.get("annual_diesel_runtime_hours", 1000)
        llm_output = {
            "diesel_runtime_reduction_hrs": int(runtime * 0.6),
            "peak_events_addressable_pct": 0.7,
            "recommended_product": "BP97E" if nmc_flag else "BP104E",
            "recommended_module_count": 4 if load_kw >= 400 else 2,
            "recommended_kwh_total": 800 if load_kw >= 400 else 400,
            "climate_risk_flag": nmc_flag or profile.get("monthly_grid_outage_count", 0) >= 3,
            "confidence": "low",
            "rationale": "LLM error. Fallback estimates used based on facility load and runtime fields.",
        }

    agent_decision_append(
        run_id=state["run_id"],
        facility_id=state["facility_id"],
        agent_name="energy_load_agent",
        input_summary=f"Facility: {profile.get('name', state['facility_id'])} | Load: {profile.get('facility_power_load_kw')}kW | Runtime: {profile.get('annual_diesel_runtime_hours')}hrs/yr | NMCflag: {nmc_flag} ",
        output_json= llm_output,
        confidence= llm_output.get("confidence", "medium"),
        rationale= llm_output.get("rationale", ""),
    )

    return {
        **state,
        "energy_load_output": llm_output,
        "status": "energy_load_done",
    }


def battery_sizing_agent(state: AgentState) -> AgentState:
    print("Battery Sizing Agent running...")

    profile = state.get("facility_profile") or {}
    energy_load_output = state.get("energy_load_output") or {}
    ira_flag = state.get("ira_credit_flag", False)

    feedback_block = ""
    if state.get("human_feedback"):
        feedback_block = f"""
    IMPORTANT — The Sustainability Director reviewed a previous analysis and
    requested revision with the following feedback:
    "{state['human_feedback']}"

    Adjust your financial projections, scenario modeling, and rationale
    accordingly based on this feedback.
    """

    user_message = f"""
    Model the financial case for adding an Accelera BESS at this Cummins facility.

    Facility profile:
    {json.dumps(profile, indent=2, default=str)}

    Energy Load Agent output:
    {json.dumps(energy_load_output, indent = 2, default=str)}

    IRA credit flag (apply 30% ITC if true): {ira_flag}
    {feedback_block}
    Calculate all three scenarios, CapEx with IRA adjustment, payback, 
    5-year NPV, and CO2 avoided. Ground the rationale in Destination Zero context.
    """

    try:
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": BATTERY_SIZING_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.2,
        )
        raw = response.choices[0].message.content.strip()
        llm_output = extract_json(raw)

    except Exception as e:
        print(f"Battery Sizing Agent LLM error: {e}")

        #fall back estimates using the facility fields
        demand = profile.get("monthly_demand_charge_usd", 5000) * 12
        diesel = profile.get("annual_diesel_fuel_cost", 30000)
        grid = profile.get("grid_electricity_rate_kwh", 0.12)
        load = profile.get("facility_power_load_kw", 500)
        modules = energy_load_output.get("recommended_module_count", 4)
        gross_capex = modules * 187500
        ira_credit = int(gross_capex * 0.30) if ira_flag else 0
        net_capex = gross_capex - ira_credit
        annual_savings = int(demand * 0.25 + diesel * 0.6)
        payback = round(net_capex / annual_savings, 1) if annual_savings > 0 else 99.0
        llm_output = {
        "scenario_continue_as_is_annual_cost_usd": int(demand + diesel),
        "scenario_upgrade_diesel_annual_cost_usd": int(demand + diesel * 0.85 + 18000),
        "scenario_add_battery_annual_cost_usd": int(demand * 0.75 + diesel * 0.4),
        "gross_capex_usd": gross_capex,
        "ira_credit_amount_usd": ira_credit,
        "ira_adjusted_capex_usd": net_capex,
        "payback_years": payback,
        "npv_5yr_usd": int(annual_savings * 3.99 - net_capex),
        "annual_demand_charge_savings_usd": int(demand * 0.25),
        "annual_diesel_cost_eliminated_usd": int(diesel * 0.6),
        "co2_avoided_metric_tons_per_year": round(
            energy_load_output.get("diesel_runtime_reduction_hrs", 500)
            * load * 0.6 * 0.000293, 1
        ),
        "confidence": "low",
        "rationale": "LLM error. Fallback estimates used. Manual review required.",
        }

    agent_decision_append(
        run_id=state["run_id"],
        facility_id=state["facility_id"],
        agent_name="battery_sizing_agent",
        input_summary=f"Facility: {profile.get('name', state['facility_id'])} | Modules: {energy_load_output.get('recommended_module_count')} x {energy_load_output.get('recommended_product')} | IRA eligible: {ira_flag}",
        output_json=llm_output,
        confidence=llm_output.get("confidence", "medium"),
        rationale=llm_output.get("rationale", ""),
    )

    return {
        **state,
        "battery_sizing_output": llm_output,
        "status": "battery_sizing_done",
    }


def build_final_proposal(state: AgentState) -> Dict[str, Any]:
    return {
        "facility_id": state["facility_id"],
        "facility_profile": state.get("facility_profile"),
        "energy_load_output": state.get("energy_load_output"),
        "battery_sizing_output": state.get("battery_sizing_output"),
        "priority_tier": state.get("priority_tier"),
        "ira_credit_flag": state.get("ira_credit_flag"),
        "nmc_recommended_flag": state.get("nmc_recommended_flag"),
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