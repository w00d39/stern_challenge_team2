from langgraph.checkpoint.base import BaseCheckpointSaver, Checkpoint, CheckpointMetadata, CheckpointTuple
from firebase_admin import firestore
from typing import Optional, Iterator
import json

class FirestoreCheckpointer(BaseCheckpointSaver):
    def __init__(self):
        self.db = firestore.client()

    def put(self, config, checkpoint, metadata, new_versions):
        thread_id = config["configurable"]["thread_id"]
        self.db.collection("checkpoints").document(thread_id).set({
            "checkpoint": json.dumps(checkpoint),
            "metadata": json.dumps(metadata),
            "updated_at": firestore.SERVER_TIMESTAMP
        })
        return config

    def get_tuple(self, config) -> Optional[CheckpointTuple]:
        thread_id = config["configurable"]["thread_id"]
        doc = self.db.collection("checkpoints").document(thread_id).get()
        if not doc.exists:
            return None
        data = doc.to_dict()
        return CheckpointTuple(
            config=config,
            checkpoint=json.loads(data["checkpoint"]),
            metadata=json.loads(data["metadata"]),
            parent_config=None
        )

    def list(self, config, limit=None, before=None) -> Iterator[CheckpointTuple]:
        return iter([])