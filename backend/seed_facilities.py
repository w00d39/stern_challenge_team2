import os, json
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

SERVICE_ACCOUNT_PATH = os.getenv("SERVICE_ACCOUNT_PATH")
if not SERVICE_ACCOUNT_PATH:
    raise RuntimeError("SERVICE_ACCOUNT_PATH not set")

if not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.Certificate(SERVICE_ACCOUNT_PATH))

db = firestore.client()

with open("cummins_facility_profiles.json", "r") as f:
    facilities = json.load(f)

for fac in facilities:
    facility_id = fac["facility_id"]

    fac["updated_at"] = firestore.SERVER_TIMESTAMP

    db.collection("facility_profiles").document(facility_id).set(fac, merge=True)
    print("upserted facility_profiles/" + facility_id)

print("done")