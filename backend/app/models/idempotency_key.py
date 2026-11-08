
from datetime import datetime
from uuid import UUID as PyUUID, uuid4

from sqlalchemy import (
    String, ForeignKey, CheckConstraint, UniqueConstraint,
    DateTime, JSON, func
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    __table_args__ = (
        UniqueConstraint(
            "user_id", "key",
            name="uq_idempotency_user_key",
        ),
        CheckConstraint(
            "status IN ('processing', 'succeeded', 'refused')",
            name="ck_idempotency_status",
        ),
    )

    id: Mapped[PyUUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid4
    )

    user_id: Mapped[PyUUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    key: Mapped[str] = mapped_column(
        String(128), nullable=False
    )

    request_hash: Mapped[str] = mapped_column(
        String(64), nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="processing"
    )

    transaction_id: Mapped[PyUUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("ledger_transactions.id", ondelete="RESTRICT"),
        unique=True,
        nullable=True,
    )

    response_body: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
