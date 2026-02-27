import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate("service-account.json")
firebase_admin.initialize_app(cred)

db = firestore.client()

doc_ref = db.collection("mcp_test").document("67")
doc_ref.set({"ok": True})