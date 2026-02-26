import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

load_dotenv()

# Init Firebase
service_account_path = os.getenv("SERVICE_ACCOUNT_PATH")
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
    docs = db.collection("test").limit(1).stream()
    return {"status": "firebase connected"}

@app.get("/test-openrouter")
async def test_openrouter():
    from openai import OpenAI
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY")
    )
    response = client.chat.completions.create(
        model="liquid/lfm-2.5-1.2b-thinking:free",
        messages=[{"role": "user", "content": "Say hello in one word"}]
    )
    return {"response": response.choices[0].message.content}

from graph import app_graph

@app.post("/test-graph")
async def test_graph(facility_id: str = "FAC-001"):
    config = {"configurable": {"thread_id": facility_id}}
    result = app_graph.invoke({
        "facility_id": facility_id,
        "facility_profile": {
            "annual_diesel_runtime_hours": 5800,
            "monthly_demand_charge_usd": 8000,
            "facility_power_load_kw": 500
        },
        "energy_load_output": None,
        "battery_sizing_output": None,
        "human_feedback": None,
        "final_proposal": None,
        "status": "starting",
        "disqualified": False,
        "disqualifier_reason": None
    }, config)
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
