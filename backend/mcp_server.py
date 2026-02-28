from typing import Any, Dict, List, Optional

from mcp.server.fastmcp import FastMCP

from firestore_tools import (
    facility_profile_get,
    facility_profile_upsert,
    proposal_create,
    proposal_get,
    proposal_save_draft,
    proposal_update,
    proposal_update_decision,
    proposal_list_pending,
    agent_decision_append,
)

mcp = FastMCP("stern-firestore-mcp")


@mcp.tool()
def ping_tool() -> Dict[str, bool]:
    return {"ok": True}


@mcp.tool()
def get_facility_profile(facility_id: str) -> Optional[Dict[str, Any]]:
    return facility_profile_get(facility_id)


@mcp.tool()
def upsert_facility_profile(facility_id: str, patch: Dict[str, Any]) -> Dict[str, bool]:
    facility_profile_upsert(facility_id, patch)
    return {"ok": True}


@mcp.tool()
def create_proposal(facility_id: str) -> Dict[str, str]:
    run_id = proposal_create(facility_id)
    return {"run_id": run_id}


@mcp.tool()
def get_proposal(run_id: str) -> Optional[Dict[str, Any]]:
    return proposal_get(run_id)


@mcp.tool()
def save_draft_proposal(
    run_id: str,
    facility_id: str,
    proposal_json: Dict[str, Any],
    urgency_score: Optional[float] = None,
) -> Dict[str, bool]:
    proposal_save_draft(run_id, facility_id, proposal_json, urgency_score)
    return {"ok": True}


@mcp.tool()
def update_proposal(
    run_id: str,
    patch: Dict[str, Any],
) -> Dict[str, bool]:
    proposal_update(run_id, patch)
    return {"ok": True}


@mcp.tool()
def update_proposal_status(
    run_id: str,
    status: str,
    reviewer_uid: str,
    feedback_text: Optional[str] = None,
) -> Dict[str, bool]:
    proposal_update_decision(run_id, status, reviewer_uid, feedback_text)
    return {"ok": True}


@mcp.tool()
def get_pending_proposals() -> List[Dict[str, Any]]:
    return proposal_list_pending()


@mcp.tool()
def save_agent_decision(
    run_id: str,
    facility_id: str,
    agent_name: str,
    input_summary: str,
    output_json: Dict[str, Any],
    confidence: str,
    rationale: str,
) -> Dict[str, bool]:
    agent_decision_append(
        run_id=run_id,
        facility_id=facility_id,
        agent_name=agent_name,
        input_summary=input_summary,
        output_json=output_json,
        confidence=confidence,
        rationale=rationale,
    )
    return {"ok": True}


if __name__ == "__main__":
    mcp.run()