
from datetime import datetime
from uuid import UUID as PyUUID, uuid4

from sqlalchemy import (
    String, Boolean, BigInteger, CheckConstraint,
    DateTime, func
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Account(Base):
    __tablename__ = "accounts"

    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'frozen', 'closed')",
            name="ck_accounts_status",
        ),
        CheckConstraint(
            "balance_paise >= -overdraft_limit_paise",
            name="ck_accounts_overdraft",
        ),
        CheckConstraint(
            "overdraft_limit_paise >= 0",
            name="ck_accounts_overdraft_nonnegative",
        ),
    )

    id: Mapped[PyUUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid4
    )

    account_number: Mapped[str] = mapped_column(
        String(24), unique=True, nullable=False, index=True
    )

    account_name: Mapped[str] = mapped_column(
        String(120), nullable=False
    )

    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="INR"
    )

    balance_paise: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0, server_default="0"
    )

    overdraft_limit_paise: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0, server_default="0"
    )

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active"
    )

    is_system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    last_entry_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    members = relationship(
        "AccountMember", back_populates="account"
    )

    ledger_entries = relationship(
        "LedgerEntry", back_populates="account"
    )
