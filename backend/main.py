import os
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials, firestore, auth
from firestore_tools import proposal_update_decision
from dotenv import load_dotenv
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
import asyncio
import json
from typing import Optional
load_dotenv(dotenv_path=".env")

# Init Firebase (once)
service_account_path = os.getenv("SERVICE_ACCOUNT_PATH")
if not service_account_path:
    raise RuntimeError("SERVICE_ACCOUNT_PATH is not set. Put it in backend/.env")

if not firebase_admin._apps:
    cred = credentials.Certificate(service_account_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TestGraphRequest(BaseModel):
    facility_id: str
    run_id: Optional[str] = None
    human_feedback: Optional[str] = None

def verify_bearer_token(authorization: str | None):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization header")

    token = authorization.split(" ", 1)[1].strip()

    try:
        decoded = auth.verify_id_token(token)
        return decoded
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

class ProposalDecisionRequest(BaseModel):
    status: str
    feedback_text: str | None = None
    
class RunRequest(BaseModel):
    facility_id: str
    human_feedback: str | None = None

@app.get("/ping")
async def ping():
    return {"status": "ok"}


@app.get("/test-firebase")
async def test_firebase():
    # If this runs, Firebase is connected
    _ = list(db.collection("test").limit(1).stream())
    return {"status": "firebase connected"}


@app.get("/test-openrouter")
async def test_openrouter():
    from openai import OpenAI

    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return {"error": "OPENROUTER_API_KEY not set"}

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )
    response = client.chat.completions.create(
        model="liquid/lfm-2.5-1.2b-thinking:free",
        messages=[{"role": "user", "content": "Say hello in one word"}],
    )
    return {"response": response.choices[0].message.content}


from graph import app_graph


@app.post("/test-graph")
async def test_graph(body: TestGraphRequest):
    import uuid

    result = app_graph.invoke(
       {
            "facility_id": body.facility_id,
            "run_id": run_id,
            "facility_profile": None,
            "energy_load_output": None,
            "battery_sizing_output": None,
            "human_feedback": body.human_feedback,
            "final_proposal": None,
            "status": "starting",
            "disqualified": False,
            "disqualifier_reason": None,
            "ira_credit_flag": None,
            "nmc_recommended_flag": None,
            "priority_tier": None,
            "revision_count": 0,
        },
        config = {"configurable": {"thread_id": run_id}} #wiring in the checkpointer
    )

    return  {
            "facility_id": body.facility_id,
            "run_id": run_id,
            "facility_profile": None,
            "energy_load_output": None,
            "battery_sizing_output": None,
            "human_feedback": body.human_feedback,
            "final_proposal": None,
            "status": "starting",
            "disqualified": False,
            "disqualifier_reason": None,
            "ira_credit_flag": None,
            "nmc_recommended_flag": None,
            "priority_tier": None,
            "revision_count": 0,
        },


@app.post("/setup-roles")
async def setup_roles():
    from firebase_admin import auth

    users = [
        {"email": "engineer@test.com", "role": "facility_engineer"},
        {"email": "director@test.com", "role": "sustainability_director"},
        {"email": "auditor@test.com", "role": "auditor"},
    ]

    for u in users:
        user = auth.get_user_by_email(u["email"])
        auth.set_custom_user_claims(user.uid, {"role": u["role"]})

    return {"status": "roles set"}

@app.post("/proposals/{run_id}/decision")
async def decide_proposal(
    run_id: str,
    body: ProposalDecisionRequest,
    authorization: str | None = Header(default=None),
):
    decoded = verify_bearer_token(authorization)
    role = decoded.get("role")
    if role != "sustainability_director":
        raise HTTPException(status_code=403, detail="Forbidden")
    reviewer_uid = decoded.get("uid")
    if not reviewer_uid:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    allowed_statuses = {"approved", "rejected", "revision_requested"}
    if body.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    proposal_update_decision(
        run_id=run_id,
        status=body.status,
        reviewer_uid=reviewer_uid,
        feedback_text=body.feedback_text,
    )
    return {"ok": True, "run_id": run_id, "status": body.status}

@app.post("/run")
async def run_graph_stream(
    body: RunRequest,
    authorization: str | None = Header(default=None),
):
    decoded = verify_bearer_token(authorization)
    role = decoded.get("role")
    if role not in {"facility_engineer", "sustainability_director"}:
        raise HTTPException(status_code=403, detail="Forbidden")

    async def event_generator():
        try:
            started_payload = {
                "stage": "started",
                "facility_id": body.facility_id,
            }
            yield f"data: {json.dumps(started_payload)}\n\n"

            init_state = {
                "facility_id": body.facility_id,
                "run_id": None,
                "facility_profile": None,
                "energy_load_output": None,
                "battery_sizing_output": None,
                "human_feedback": body.human_feedback,
                "final_proposal": None,
                "status": "starting",
                "disqualified": False,
                "disqualifier_reason": None,
            }

            running_payload = {
                "stage": "running_orchestrator",
            }
            yield f"data: {json.dumps(running_payload)}\n\n"
            await asyncio.sleep(0)

            result = app_graph.invoke(init_state)

            finished_payload = {
                "stage": "finished",
                "status": result.get("status"),
                "disqualified": result.get("disqualified"),
                "run_id": result.get("run_id"),
            }
            yield f"data: {json.dumps(finished_payload)}\n\n"

        except Exception as e:
            error_payload = {
                "stage": "error",
                "error": str(e),
            }
            yield f"data: {json.dumps(error_payload)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")