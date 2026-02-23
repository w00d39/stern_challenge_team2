import os, json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials, firestore

#init firebase
cred = credentials.Certificate("service-account.json")
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
#testing fastapi
@app.get("/ping")
async def ping():
    return {"status": "ok"}

@app.get("/test-firebase")
async def test_firebase():
#trying to get data from firestore
    docs = db.collection("test").limit(1).stream()
    return {"status": "firebase connected!!"}
