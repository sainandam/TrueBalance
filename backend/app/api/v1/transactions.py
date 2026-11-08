from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.security.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.transaction import (
    DepositRequest,
    WithdrawalRequest,
    TransferRequest,
    TransactionResponse,
)
from app.services.transaction_service import TransactionService

router = APIRouter(prefix="/transactions", tags=["Financial Transactions & Ledger"])


@router.post(
    "/deposits",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Deposit funds into an account",
)
def deposit_funds(
    req: DepositRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Execute double-entry deposit from System World clearinghouse into customer account."""
    return TransactionService.deposit(db, current_user, req)


@router.post(
    "/withdrawals",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Withdraw funds from an account",
)
def withdraw_funds(
    req: WithdrawalRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Execute double-entry withdrawal from customer account into System World clearinghouse."""
    return TransactionService.withdraw(db, current_user, req)


@router.post(
    "/transfers",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Atomic internal transfer between accounts",
)
def transfer_funds(
    req: TransferRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Execute double-entry internal transfer between two accounts with deterministic row locking."""
    return TransactionService.transfer(db, current_user, req)


@router.get(
    "/{transaction_id}",
    response_model=TransactionResponse,
    summary="Inspect ledger transaction and postings",
)
def get_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve full transaction header and double-entry postings."""
    return TransactionService.get_transaction_by_id(db, current_user, transaction_id)
