
from uuid import UUID as PyUUID, uuid4

from sqlalchemy import (
    String, Text, ForeignKey, JSON, DateTime, func
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[PyUUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid4
    )

    actor_id: Mapped[PyUUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    action: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    target_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )

    target_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )

    description: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    details: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=dict
    )

    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
