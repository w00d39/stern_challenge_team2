import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

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
            "case_id": None,
            "hitl_ticket_id": None,
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