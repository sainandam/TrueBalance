
from datetime import datetime
from uuid import UUID as PyUUID, uuid4

from sqlalchemy import (
    BigInteger, Integer, String, ForeignKey,
    CheckConstraint, UniqueConstraint, DateTime, func
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    __table_args__ = (
        CheckConstraint(
            "amount_paise <> 0",
            name="ck_ledger_entries_nonzero_amount",
        ),
        UniqueConstraint(
            "ledger_transaction_id",
            "entry_number",
            name="uq_ledger_entry_number",
        ),
    )

    id: Mapped[PyUUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid4
    )

    ledger_transaction_id: Mapped[PyUUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("ledger_transactions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    account_id: Mapped[PyUUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    entry_number: Mapped[int] = mapped_column(
        Integer, nullable=False
    )

    amount_paise: Mapped[int] = mapped_column(
        BigInteger, nullable=False
    )

    running_balance_paise: Mapped[int] = mapped_column(
        BigInteger, nullable=False
    )

    prev_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )

    entry_hash: Mapped[str] = mapped_column(
        String(64), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    transaction = relationship(
        "LedgerTransaction", back_populates="entries"
    )

    account = relationship(
        "Account", back_populates="ledger_entries"
    )
