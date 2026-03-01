import firebase_admin
from firebase_admin import credentials, auth

cred = credentials.Certificate("service-account.json")
firebase_admin.initialize_app(cred)

users = [
    {"email": "engineer@test.com", "role": "facility_engineer"},
    {"email": "director@test.com", "role": "sustainability_director"},
    {"email": "auditor@test.com",  "role": "auditor"},
]

for u in users:
    user = auth.get_user_by_email(u["email"])
    auth.set_custom_user_claims(user.uid, {"role": u["role"]})
    print(f"Set role {u['role']} for {u['email']}")