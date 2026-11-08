"""
Idempotency service ensuring duplicate client requests never execute twice.
Supports SHA-256 payload verification, in-flight concurrent collision detection,
and atomic cached response replay.
"""

import hashlib
import json
from uuid import UUID, uuid4
from typing import Optional, Tuple, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.idempotency_key import IdempotencyKey


class IdempotencyService:
    @staticmethod
    def compute_request_hash(endpoint: str, payload: dict) -> str:
        """
        Computes SHA-256 hash of canonical (endpoint, payload) representation.
        Ensures keys cannot be reused with altered payloads.
        """
        def serialize_item(obj: Any) -> str:
            if isinstance(obj, UUID):
                return str(obj)
            raise TypeError(f"Type {type(obj)} not serializable")

        canonical_data = {
            "endpoint": endpoint,
            "payload": payload,
        }
        canonical_str = json.dumps(canonical_data, sort_keys=True, default=serialize_item)
        return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

    @staticmethod
    def check_or_start(
        db: Session,
        user_id: UUID,
        key: str,
        endpoint: str,
        payload: dict,
    ) -> Tuple[Optional[dict], Optional[IdempotencyKey]]:
        """
        Checks if the idempotency key already exists:
        - If 'succeeded': returns (cached_response_dict, None)
        - If 'refused': raises HTTPException with cached refusal
        - If 'processing': raises 409 Conflict (concurrent duplicate in progress)
        - If not exists: creates new IdempotencyKey with status='processing' and returns (None, key_obj)
        """
        req_hash = IdempotencyService.compute_request_hash(endpoint, payload)

        existing = (
            db.query(IdempotencyKey)
            .filter_by(user_id=user_id, key=key)
            .first()
        )

        if existing:
            if existing.request_hash != req_hash:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Idempotency key reused with different request payload or endpoint.",
                )

            if existing.status == "succeeded":
                return existing.response_body, None

            if existing.status == "processing":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A request with this idempotency key is currently being processed. Please retry shortly.",
                )

            if existing.status == "refused":
                detail_msg = (
                    existing.response_body.get("detail", "Previous transaction with this idempotency key was refused.")
                    if existing.response_body
                    else "Previous transaction with this idempotency key was refused."
                )
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=detail_msg,
                )

        # Create new key in 'processing' status
        new_key = IdempotencyKey(
            id=uuid4(),
            user_id=user_id,
            key=key,
            request_hash=req_hash,
            status="processing",
        )
        try:
            db.add(new_key)
            db.flush()
            return None, new_key
        except IntegrityError:
            db.rollback()
            # Concurrent race condition: another thread inserted the same key!
            existing = (
                db.query(IdempotencyKey)
                .filter_by(user_id=user_id, key=key)
                .first()
            )
            if existing and existing.status == "succeeded":
                if existing.request_hash != req_hash:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail="Idempotency key reused with different request payload or endpoint.",
                    )
                return existing.response_body, None

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A request with this idempotency key is currently being processed. Please retry shortly.",
            )

    @staticmethod
    def complete(
        db: Session,
        key_obj: IdempotencyKey,
        transaction_id: UUID,
        response_dict: dict,
    ) -> None:
        """Mark idempotency key as succeeded with cached response body."""
        key_obj.status = "succeeded"
        key_obj.transaction_id = transaction_id
        key_obj.response_body = response_dict
        db.flush()

    @staticmethod
    def fail(
        db: Session,
        key_obj: IdempotencyKey,
        refusal_detail: str,
    ) -> None:
        """Mark idempotency key as refused with refusal details."""
        key_obj.status = "refused"
        key_obj.response_body = {"detail": refusal_detail}
        db.flush()

