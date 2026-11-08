from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.security.deps import get_db, get_current_user, require_roles
from app.models.user import User
from app.schemas.account import (
    AccountCreateRequest,
    AccountResponse,
    AccountMemberAddRequest,
    AccountMemberResponse,
    AccountStatusUpdateRequest,
)
from app.services.account_service import AccountService

router = APIRouter(prefix="/accounts", tags=["Account Management & Membership"])


@router.post(
    "",
    response_model=AccountResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new financial account",
)
def create_account(
    req: AccountCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new account with the caller as primary Owner."""
    return AccountService.create_account(db, current_user, req)


@router.get(
    "",
    response_model=List[AccountResponse],
    summary="List accessible accounts",
)
def list_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List financial accounts the caller is authorized to view."""
    return AccountService.get_user_accounts(db, current_user)


@router.get(
    "/{account_id}",
    response_model=AccountResponse,
    summary="Get account by ID (IDOR-protected)",
)
def get_account(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve details for a specific financial account."""
    return AccountService.get_account_by_id(db, current_user, account_id)


@router.post(
    "/{account_id}/members",
    response_model=AccountMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add or update account membership permissions",
)
def add_account_member(
    account_id: UUID,
    req: AccountMemberAddRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a member or update permissions (Owner or Admin only)."""
    return AccountService.add_account_member(db, current_user, account_id, req)


@router.get(
    "/{account_id}/members",
    response_model=List[AccountMemberResponse],
    summary="List all members of an account",
)
def list_account_members(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List account members and permissions (restricted to authorized viewers)."""
    return AccountService.list_account_members(db, current_user, account_id)


@router.patch(
    "/{account_id}/status",
    response_model=AccountResponse,
    summary="Admin-only lifecycle control: freeze, unfreeze, or close account",
)
def update_account_status(
    account_id: UUID,
    req: AccountStatusUpdateRequest,
    admin_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Admin-only lifecycle modification (e.g. freezing an account during investigations)."""
    return AccountService.update_account_status(db, admin_user, account_id, req)

