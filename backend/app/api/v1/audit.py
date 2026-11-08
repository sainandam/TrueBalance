from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.security.deps import get_db, get_current_user, require_roles
from app.models.user import User
from app.schemas.audit import (
    LedgerVerificationReport,
    AccountStatementResponse,
    AuditLogResponse,
)
from app.services.audit_service import AuditService

router = APIRouter(prefix="/audit", tags=["Audit, Statements & Integrity Verification"])


@router.get(
    "/verify",
    response_model=LedgerVerificationReport,
    summary="Cryptographic verification of full ledger",
)
def verify_full_ledger(
    current_user: User = Depends(require_roles("admin", "auditor")),
    db: Session = Depends(get_db),
):
    """
    Supervisory endpoint: Verifies SHA-256 hash chains across all ledger entries,
    validates projected running balances against account balances,
    and enforces the global zero-sum invariant across the entire system.
    """
    return AuditService.verify_ledger_integrity(db)


@router.get(
    "/verify/{account_id}",
    response_model=LedgerVerificationReport,
    summary="Cryptographic verification of a specific account ledger",
)
def verify_account_ledger(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify hash chain continuity and balance projection for a specific account."""
    return AuditService.verify_ledger_integrity(db, account_id=account_id)


@router.get(
    "/statements/{account_id}",
    response_model=AccountStatementResponse,
    summary="Retrieve account statement and refused attempts",
)
def get_statement(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve official account statement.
    Combines chronological ledger entries and durable refused transaction attempts.
    Protected by IDOR access control checks.
    """
    return AuditService.get_account_statement(db, current_user, account_id)


@router.get(
    "/logs",
    response_model=List[AuditLogResponse],
    summary="Inspect security audit log",
)
def get_audit_logs(
    limit: int = Query(100, ge=1, le=1000),
    action: Optional[str] = Query(None),
    current_user: User = Depends(require_roles("admin", "auditor")),
    db: Session = Depends(get_db),
):
    """Supervisory endpoint: Inspect append-only audit trail."""
    return AuditService.get_audit_logs(db, current_user, limit=limit, action=action)

