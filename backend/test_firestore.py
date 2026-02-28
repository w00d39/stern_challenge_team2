import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate("service-account.json")
firebase_admin.initialize_app(cred)

db = firestore.client()

doc_ref = db.collection("facility_profiles").document("firestore_smoke_test")
doc_ref.set(
    {
        "name": "Firestore Smoke Test Facility",
        "annual_diesel_runtime_hours": 0,
        "monthly_demand_charge_usd": 0,
        "facility_power_load_kw": 0,
        "updated_at": firestore.SERVER_TIMESTAMP,
        "ira_eligible": False,
        "climate_zone": "",
        "grid_carbon_intensity_lbs_kwh": 0,
        "esg_mandate": False,
        "annual_diesel_fuel_cost": 0,
        "grid_electricity_rate_kwh": 0,
        "existing_solar_kw": 0,
        "monthly_grid_outage_count": 0,
        "maintenance_contract_status": "",
        "facility_type": "",
    }
)

print("Wrote facility_profiles/firestore_smoke_test")