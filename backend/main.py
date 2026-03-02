import os
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials, firestore, auth
from firestore_tools import proposal_update_decision
from dotenv import load_dotenv
from pydantic import BaseModel

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
async def test_graph(facility_id: str = "demo_facility"):
    result = app_graph.invoke(
        {
            "facility_id": facility_id,
            "run_id": None,
            "facility_profile": None,
            "energy_load_output": None,
            "battery_sizing_output": None,
            "human_feedback": None,
            "final_proposal": None,
            "status": "starting",
            "disqualified": False,
            "disqualifier_reason": None,
        }
    )
    return {"status": result["status"], "disqualified": result["disqualified"]}


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