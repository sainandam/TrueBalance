
from uuid import UUID as PyUUID

from sqlalchemy import (
    String, Boolean, ForeignKey, CheckConstraint, DateTime, func
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class AccountMember(Base):
    __tablename__ = "account_members"

    __table_args__ = (
        CheckConstraint(
            "member_role IN ('owner', 'operator', 'viewer')",
            name="ck_account_members_role",
        ),
    )

    account_id: Mapped[PyUUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        primary_key=True,
    )

    user_id: Mapped[PyUUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        primary_key=True,
    )

    member_role: Mapped[str] = mapped_column(
        String(20), nullable=False, default="viewer"
    )

    can_view: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    can_deposit: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    can_withdraw: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    can_transfer: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user = relationship(
        "User", back_populates="account_memberships"
    )

    account = relationship(
        "Account", back_populates="members"
    )
