import asyncio
import json
from typing import Optional, Iterator, AsyncIterator

import firebase_admin
from firebase_admin import firestore
from langgraph.checkpoint.base import BaseCheckpointSaver, CheckpointTuple


class FirestoreCheckpointer(BaseCheckpointSaver):
    def __init__(self):
        # Ensure Firebase app exists (main.py usually initializes it)
        if not firebase_admin._apps:
            raise RuntimeError(
                "Firebase not initialized. Initialize firebase_admin in main.py before using FirestoreCheckpointer."
            )
        self.db = firestore.client()

    def put(self, config, checkpoint, metadata, new_versions):
        thread_id = config["configurable"]["thread_id"]
        self.db.collection("checkpoints").document(thread_id).set(
            {
                "checkpoint": json.dumps(checkpoint, default=str),
                "metadata": json.dumps(metadata, default=str),
                "updated_at": firestore.SERVER_TIMESTAMP,
            }
        )
        return config

    def put_writes(self, config, writes, task_id, task_path=None):
        thread_id = config["configurable"]["thread_id"]
        self.db.collection("checkpoints").document(f"{thread_id}_writes").set(
            {
                "writes": json.dumps([(w[0], w[1]) for w in writes], default=str),
                "task_id": task_id,
                "task_path": task_path,
                "updated_at": firestore.SERVER_TIMESTAMP,
            }
        )

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
            parent_config=None,
        )

    def list(self, config, limit=None, before=None) -> Iterator[CheckpointTuple]:
        # Not needed for MVP
        return iter([])

    async def aget_tuple(self, config) -> Optional[CheckpointTuple]:
        return await asyncio.to_thread(self.get_tuple, config)

    async def aput(
        self,
        config,
        checkpoint,
        metadata,
        new_versions,
    ):
        return await asyncio.to_thread(self.put, config, checkpoint, metadata, new_versions)

    async def aput_writes(
        self,
        config,
        writes,
        task_id: str,
        task_path: str = "",
    ) -> None:
        await asyncio.to_thread(self.put_writes, config, writes, task_id, task_path)

    async def alist(
        self,
        config=None,
        *,
        filter=None,
        before=None,
        limit=None,
    ) -> AsyncIterator[CheckpointTuple]:
        result = await asyncio.to_thread(self.list, config, limit=limit, before=before)
        for item in result:
            yield item