"""
Unified tools for the graph. Uses MCP when USE_MCP=true, else firestore_tools directly.
Set USE_MCP=false in .env to bypass MCP if it fails (e.g. TaskGroup errors).
"""
import asyncio
import os

USE_MCP = os.getenv("USE_MCP", "true").lower() in ("true", "1", "yes")

if USE_MCP:
    from mcp_tools import (
        get_facility_profile,
        create_proposal,
        update_proposal,
        save_draft_proposal,
        save_agent_decision,
    )
else:
    from firestore_tools import (
        facility_profile_get,
        proposal_create,
        proposal_update,
        proposal_save_draft,
        agent_decision_append,
    )

    async def get_facility_profile(facility_id: str):
        return await asyncio.to_thread(facility_profile_get, facility_id)

    async def create_proposal(facility_id: str) -> str:
        return await asyncio.to_thread(proposal_create, facility_id)

    async def update_proposal(run_id: str, patch: dict):
        return await asyncio.to_thread(proposal_update, run_id, patch)

    async def save_draft_proposal(run_id: str, facility_id: str, proposal_json: dict, urgency_score=None):
        return await asyncio.to_thread(proposal_save_draft, run_id, facility_id, proposal_json, urgency_score)

    async def save_agent_decision(
        run_id: str, facility_id: str, agent_name: str,
        input_summary: str, output_json: dict, confidence: str, rationale: str,
    ):
        return await asyncio.to_thread(
            agent_decision_append,
            run_id, facility_id, agent_name,
            input_summary, output_json, confidence, rationale,
        )
