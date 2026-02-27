import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore import FieldFilter
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")

_app = None
_db = None


def now_ts():
    return datetime.now(timezone.utc)


def init_db():
    global _app, _db
    if _db is not None:
        return _db

    # Reuse already-initialized default app (e.g. main.py)
    if firebase_admin._apps:
        _app = firebase_admin.get_app()
    else:
        service_account_path = os.getenv("SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")
        cred = credentials.Certificate(service_account_path)
        _app = firebase_admin.initialize_app(cred)

    _db = firestore.client()
    return _db


def audit_append(
    case_id: str,
    agent: str,
    action: str,
    inputs_summary: str,
    output_summary: str,
    rationale: str,
) -> None:
    db = init_db()
    db.collection("audit_logs").add(
        {
            "case_id": case_id,
            "ts": now_ts(),
            "agent": agent,
            "action": action,
            "inputs_summary": inputs_summary,
            "output_summary": output_summary,
            "rationale": rationale,
        }
    )


def facility_get(facility_id: str) -> Optional[Dict[str, Any]]:
    db = init_db()
    snap = db.collection("facilities").document(facility_id).get()
    if not snap.exists:
        return None
    out = snap.to_dict()
    out["facility_id"] = facility_id
    return out


def facility_upsert(facility_id: str, patch: Dict[str, Any]) -> None:
    db = init_db()
    patch = dict(patch)
    patch["updated_at"] = now_ts()
    db.collection("facilities").document(facility_id).set(patch, merge=True)


def case_create(facility_id: str) -> str:
    db = init_db()
    ref = db.collection("cases").document()
    ref.set(
        {
            "facility_id": facility_id,
            "status": "created",
            "created_at": now_ts(),
            "updated_at": now_ts(),
        }
    )
    return ref.id


def case_get(case_id: str) -> Optional[Dict[str, Any]]:
    db = init_db()
    snap = db.collection("cases").document(case_id).get()
    if not snap.exists:
        return None
    out = snap.to_dict()
    out["case_id"] = case_id
    return out


def case_update(case_id: str, patch: Dict[str, Any]) -> None:
    db = init_db()
    patch = dict(patch)
    patch["updated_at"] = now_ts()
    db.collection("cases").document(case_id).set(patch, merge=True)


def hitl_create(
    case_id: str,
    question: str,
    context: Dict[str, Any],
    options: List[str],
) -> str:
    db = init_db()
    ref = db.collection("hitl_tickets").document()
    ref.set(
        {
            "case_id": case_id,
            "status": "open",
            "question": question,
            "context": context,
            "options": options,
            "created_at": now_ts(),
        }
    )
    return ref.id


def hitl_list_open(case_id: str) -> List[Dict[str, Any]]:
    db = init_db()
    q = (
        db.collection("hitl_tickets")
        .where(filter=FieldFilter("case_id", "==", case_id))
        .where(filter=FieldFilter("status", "==", "open"))
    )

    out: List[Dict[str, Any]] = []
    for doc in q.stream():
        d = doc.to_dict()
        d["ticket_id"] = doc.id
        out.append(d)
    return out


def hitl_resolve(ticket_id: str, decision: str, notes: str, reviewer: str) -> None:
    db = init_db()
    db.collection("hitl_tickets").document(ticket_id).set(
        {
            "status": "resolved",
            "resolved_at": now_ts(),
            "resolution": {
                "decision": decision,
                "notes": notes,
                "reviewer": reviewer,
            },
        },
        merge=True,
    )