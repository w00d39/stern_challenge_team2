"""
MCP tool wrappers for the graph. The graph calls these instead of firestore_tools directly.
Requires mcp_session to be set via set_mcp_session() before running the graph.
"""
import json
import os
from contextvars import ContextVar
from typing import Any, Dict, List, Optional

_mcp_session: ContextVar[Any] = ContextVar("mcp_session", default=None)


def set_mcp_session(session):
    _mcp_session.set(session)


def clear_mcp_session():
    try:
        _mcp_session.set(None)
    except LookupError:
        pass


def _get_session():
    s = _mcp_session.get()
    if s is None:
        raise RuntimeError("MCP session not set. Call set_mcp_session() before running the graph.")
    return s


def _parse_result(result) -> Any:
    """Parse CallToolResult to Python object."""
    if result.isError:
        err_text = ""
        if result.content:
            err_text = getattr(result.content[0], "text", str(result.content[0]))
        raise RuntimeError(f"MCP tool error: {err_text}")
    if not result.content:
        return None
    text = getattr(result.content[0], "text", None)
    if text is None:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


async def get_facility_profile(facility_id: str) -> Optional[Dict[str, Any]]:
    session = _get_session()
    result = await session.call_tool("get_facility_profile", {"facility_id": facility_id})
    return _parse_result(result)


async def create_proposal(facility_id: str) -> str:
    session = _get_session()
    result = await session.call_tool("create_proposal", {"facility_id": facility_id})
    data = _parse_result(result)
    return data.get("run_id") if isinstance(data, dict) else None


async def update_proposal(run_id: str, patch: Dict[str, Any]) -> None:
    session = _get_session()
    await session.call_tool("update_proposal", {"run_id": run_id, "patch": patch})


async def save_draft_proposal(
    run_id: str,
    facility_id: str,
    proposal_json: Dict[str, Any],
    urgency_score: Optional[float] = None,
) -> None:
    session = _get_session()
    args = {"run_id": run_id, "facility_id": facility_id, "proposal_json": proposal_json}
    if urgency_score is not None:
        args["urgency_score"] = urgency_score
    await session.call_tool("save_draft_proposal", args)


async def save_agent_decision(
    run_id: str,
    facility_id: str,
    agent_name: str,
    input_summary: str,
    output_json: Dict[str, Any],
    confidence: str,
    rationale: str,
) -> None:
    session = _get_session()
    await session.call_tool(
        "save_agent_decision",
        {
            "run_id": run_id,
            "facility_id": facility_id,
            "agent_name": agent_name,
            "input_summary": input_summary,
            "output_json": output_json,
            "confidence": confidence,
            "rationale": rationale,
        },
    )
