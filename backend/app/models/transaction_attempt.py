
from uuid import UUID as PyUUID, uuid4

from sqlalchemy import (
    String, BigInteger, ForeignKey, CheckConstraint,
    DateTime, func
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TransactionAttempt(Base):
    __tablename__ = "transaction_attempts"

    __table_args__ = (
        CheckConstraint(
            "request_type IN ('deposit', 'withdrawal', 'transfer', 'adjustment')",
            name="ck_attempt_request_type",
        ),
        CheckConstraint(
            "outcome IN ('accepted', 'refused')",
            name="ck_attempt_outcome",
        ),
        CheckConstraint(
            "amount_paise IS NULL OR amount_paise > 0",
            name="ck_attempt_positive_amount",
        ),
    )

    id: Mapped[PyUUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid4
    )

    user_id: Mapped[PyUUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    request_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )

    source_account_id: Mapped[PyUUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=True,
    )

    target_account_id: Mapped[PyUUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=True,
    )

    amount_paise: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True
    )

    outcome: Mapped[str] = mapped_column(
        String(20), nullable=False
    )

    reason_code: Mapped[str | None] = mapped_column(
        String(80), nullable=True
    )

    idempotency_key: Mapped[str | None] = mapped_column(
        String(128), nullable=True
    )

    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
