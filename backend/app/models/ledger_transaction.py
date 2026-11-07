
from uuid import UUID as PyUUID, uuid4

from sqlalchemy import (
    String, Text, ForeignKey, CheckConstraint, DateTime, func
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class LedgerTransaction(Base):
    __tablename__ = "ledger_transactions"

    __table_args__ = (
        CheckConstraint(
            "transaction_type IN "
            "('deposit', 'withdrawal', 'transfer', 'adjustment', 'reversal')",
            name="ck_ledger_transactions_type",
        ),
    )

    id: Mapped[PyUUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid4
    )

    transaction_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )

    initiator_user_id: Mapped[PyUUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    reason: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    entries = relationship(
        "LedgerEntry", back_populates="transaction"
    )
