from typing import Any, Dict, List, Optional

from mcp.server.fastmcp import FastMCP

from firestore_tools import (
    facility_get,
    facility_upsert,
    case_create,
    case_get,
    case_update,
    hitl_create,
    hitl_list_open,
    hitl_resolve,
    audit_append,
)

mcp = FastMCP("stern-firestore-mcp")


@mcp.tool()
def ping_tool() -> Dict[str, bool]:
    return {"ok": True}


@mcp.tool()
def facility_get_tool(facility_id: str) -> Optional[Dict[str, Any]]:
    return facility_get(facility_id)


@mcp.tool()
def facility_upsert_tool(facility_id: str, patch: Dict[str, Any]) -> Dict[str, bool]:
    facility_upsert(facility_id, patch)
    return {"ok": True}


@mcp.tool()
def case_create_tool(facility_id: str) -> Dict[str, str]:
    return {"case_id": case_create(facility_id)}


@mcp.tool()
def case_get_tool(case_id: str) -> Optional[Dict[str, Any]]:
    return case_get(case_id)


@mcp.tool()
def case_update_tool(case_id: str, patch: Dict[str, Any]) -> Dict[str, bool]:
    case_update(case_id, patch)
    return {"ok": True}


@mcp.tool()
def hitl_create_tool(
    case_id: str,
    question: str,
    context: Dict[str, Any],
    options: List[str],
) -> Dict[str, str]:
    return {"ticket_id": hitl_create(case_id, question, context, options)}


@mcp.tool()
def hitl_list_open_tool(case_id: str) -> List[Dict[str, Any]]:
    return hitl_list_open(case_id)


@mcp.tool()
def hitl_resolve_tool(ticket_id: str, decision: str, notes: str, reviewer: str) -> Dict[str, bool]:
    hitl_resolve(ticket_id, decision, notes, reviewer)
    return {"ok": True}


@mcp.tool()
def audit_append_tool(
    case_id: str,
    agent: str,
    action: str,
    inputs_summary: str,
    output_summary: str,
    rationale: str,
) -> Dict[str, bool]:
    audit_append(case_id, agent, action, inputs_summary, output_summary, rationale)
    return {"ok": True}


if __name__ == "__main__":
    mcp.run()