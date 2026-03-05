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

    if firebase_admin._apps:
        _app = firebase_admin.get_app()
    else:
        service_account_path = os.getenv("SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")
        cred = credentials.Certificate(service_account_path)
        _app = firebase_admin.initialize_app(cred)

    _db = firestore.client()
    return _db


def facility_profile_get(facility_id: str) -> Optional[Dict[str, Any]]:
    db = init_db()
    snap = db.collection("facility_profiles").document(facility_id).get()
    if not snap.exists:
        return None
    out = snap.to_dict()
    out["facility_id"] = facility_id
    return out


def facility_profile_upsert(facility_id: str, patch: Dict[str, Any]) -> None:
    db = init_db()
    patch = dict(patch)
    patch["updated_at"] = now_ts()
    db.collection("facility_profiles").document(facility_id).set(patch, merge=True)


def proposal_create(facility_id: str) -> str:
    db = init_db()
    ref = db.collection("proposals").document()
    run_id = ref.id
    ref.set(
        {
            "run_id": run_id,
            "facility_id": facility_id,
            "status": "created",
            "proposal_json": None,
            "urgency_score": None,
            "revision_count": 0,
            "reviewer_uid": None,
            "feedback_text": None,
            "created_at": now_ts(),
            "reviewed_at": None,
            "updated_at": now_ts(),
        }
    )
    return run_id


def proposal_get(run_id: str) -> Optional[Dict[str, Any]]:
    db = init_db()
    snap = db.collection("proposals").document(run_id).get()
    if not snap.exists:
        return None
    out = snap.to_dict()
    out["run_id"] = run_id
    return out


def proposal_update(run_id: str, patch: Dict[str, Any]) -> None:
    db = init_db()
    patch = dict(patch)
    patch["updated_at"] = now_ts()
    db.collection("proposals").document(run_id).set(patch, merge=True)


def proposal_supersede_older_pending(facility_id: str, keep_run_id: str) -> int:
    """Mark older pending_review proposals for this facility as rejected. Director only sees latest."""
    db = init_db()
    q = (
        db.collection("proposals")
        .where(filter=FieldFilter("facility_id", "==", facility_id))
        .where(filter=FieldFilter("status", "==", "pending_review"))
    )
    count = 0
    for doc in q.stream():
        if doc.id == keep_run_id:
            continue
        doc.reference.set(
            {
                "status": "rejected",
                "feedback_text": "Superseded by newer run",
                "updated_at": now_ts(),
            },
            merge=True,
        )
        count += 1
    return count


def proposal_save_draft(
    run_id: str,
    facility_id: str,
    proposal_json: Dict[str, Any],
    urgency_score: Optional[float] = None,
) -> None:
    db = init_db()
    # Supersede older pending proposals for this facility — only latest matters
    proposal_supersede_older_pending(facility_id, run_id)
    db.collection("proposals").document(run_id).set(
        {
            "run_id": run_id,
            "facility_id": facility_id,
            "proposal_json": proposal_json,
            "urgency_score": urgency_score,
            "status": "pending_review",
            "updated_at": now_ts(),
        },
        merge=True,
    )


def proposal_update_decision(
    run_id: str,
    status: str,
    reviewer_uid: str,
    feedback_text: Optional[str] = None,
) -> None:
    db = init_db()
    snap = db.collection("proposals").document(run_id).get()
    if not snap.exists:
        raise ValueError(f"Proposal {run_id} not found")
    data = snap.to_dict() or {}

    # When approving/rejecting, mark all other pending_review for this facility as rejected
    # so Director only ever sees one proposal per facility
    if status in ("approved", "rejected"):
        facility_id = data.get("facility_id")
        if facility_id:
            proposal_supersede_older_pending(facility_id, run_id)

    patch: Dict[str, Any] = {
        "status": status,
        "reviewer_uid": reviewer_uid,
        "feedback_text": feedback_text,
        "reviewed_at": now_ts(),
        "updated_at": now_ts(),
    }

    if status == "revision_requested":
        revision_count = int(data.get("revision_count", 0))
        patch["revision_count"] = revision_count + 1

    db.collection("proposals").document(run_id).set(patch, merge=True)


def proposal_list_pending() -> List[Dict[str, Any]]:
    db = init_db()
    q = (
        db.collection("proposals")
        .where(filter=FieldFilter("status", "==", "pending_review"))
        .order_by("urgency_score", direction=firestore.Query.DESCENDING)
    )

    out: List[Dict[str, Any]] = []
    for doc in q.stream():
        d = doc.to_dict()
        d["run_id"] = doc.id
        out.append(d)
    return out


def agent_decision_append(
    run_id: str,
    facility_id: str,
    agent_name: str,
    input_summary: str,
    output_json: Dict[str, Any],
    confidence: str,
    rationale: str,
) -> None:
    db = init_db()
    db.collection("agent_decisions").add(
        {
            "run_id": run_id,
            "facility_id": facility_id,
            "agent_name": agent_name,
            "input_summary": input_summary,
            "output_json": output_json,
            "confidence": confidence,
            "rationale": rationale,
            "timestamp": now_ts(),
        }
    )