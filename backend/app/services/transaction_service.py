"""
Transaction service implementing deposits, withdrawals, and internal transfers
with row-level locking, deterministic lock ordering (deadlock prevention),
negative-balance prevention, and durable attempt tracking.
"""

from uuid import UUID, uuid4
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.account_member import AccountMember
from app.models.user import User
from app.models.transaction_attempt import TransactionAttempt
from app.models.ledger_transaction import LedgerTransaction
from app.schemas.transaction import (
    DepositRequest,
    WithdrawalRequest,
    TransferRequest,
    TransactionResponse,
    LedgerEntryResponse,
)
from app.services.ledger_service import LedgerService


class TransactionService:
    @staticmethod
    def _record_attempt(
        db: Session,
        user_id: UUID,
        request_type: str,
        source_id: Optional[UUID],
        target_id: Optional[UUID],
        amount_paise: int,
        outcome: str,
        reason_code: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> TransactionAttempt:
        """Durable record of accepted or refused transaction attempts."""
        attempt = TransactionAttempt(
            id=uuid4(),
            user_id=user_id,
            request_type=request_type,
            source_account_id=source_id,
            target_account_id=target_id,
            amount_paise=amount_paise,
            outcome=outcome,
            reason_code=reason_code,
            idempotency_key=idempotency_key,
        )
        db.add(attempt)
        db.flush()
        return attempt

    @staticmethod
    def _get_system_world_account(db: Session) -> Account:
        """Retrieve the external clearinghouse account (SYS-WORLD-001)."""
        acc = db.query(Account).filter_by(account_number="SYS-WORLD-001").first()
        if not acc:
            raise RuntimeError("Critical: System clearinghouse account (SYS-WORLD-001) not found in database!")
        return acc

    @staticmethod
    def deposit(
        db: Session, caller: User, req: DepositRequest, idempotency_key: Optional[str] = None
    ) -> TransactionResponse:
        """Execute a deposit from the external world into a customer account."""
        target_acc = db.query(Account).filter_by(id=req.target_account_id).first()
        if not target_acc or target_acc.is_system:
            TransactionService._record_attempt(
                db, caller.id, "deposit", None, req.target_account_id, req.amount_paise, "refused", "ACCOUNT_NOT_FOUND"
            )
            db.commit()
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target account not found.")

        if target_acc.status != "active":
            TransactionService._record_attempt(
                db, caller.id, "deposit", None, req.target_account_id, req.amount_paise, "refused", "ACCOUNT_FROZEN"
            )
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Target account is {target_acc.status}. Deposits are forbidden.",
            )

        # Permission check: Caller must be admin or member with can_deposit
        if caller.role != "admin":
            mem = db.query(AccountMember).filter_by(account_id=target_acc.id, user_id=caller.id).first()
            if not mem or not mem.can_deposit:
                TransactionService._record_attempt(
                    db, caller.id, "deposit", None, req.target_account_id, req.amount_paise, "refused", "PERMISSION_DENIED"
                )
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Caller does not have deposit authorization for this account.",
                )

        sys_world = TransactionService._get_system_world_account(db)

        # Deterministic Lock Ordering on Accounts
        first_id, second_id = sorted([sys_world.id, target_acc.id])
        acc1 = db.query(Account).filter_by(id=first_id).with_for_update().first()
        acc2 = db.query(Account).filter_by(id=second_id).with_for_update().first()

        locked_sys = acc1 if acc1.id == sys_world.id else acc2
        locked_target = acc1 if acc1.id == target_acc.id else acc2

        # Double-entry postings: Debit System World (-amount), Credit Customer (+amount)
        postings = [
            (locked_sys, -req.amount_paise),
            (locked_target, req.amount_paise),
        ]
        tx, entries = LedgerService.post_double_entry(
            db,
            transaction_type="deposit",
            initiator_user_id=caller.id,
            reason=req.reason,
            postings=postings,
        )

        TransactionService._record_attempt(
            db, caller.id, "deposit", None, locked_target.id, req.amount_paise, "accepted", None, idempotency_key
        )
        db.commit()

        return TransactionResponse(
            transaction_id=tx.id,
            transaction_type=tx.transaction_type,
            reason=tx.reason,
            created_at=tx.created_at,
            entries=[LedgerEntryResponse.model_validate(e) for e in entries],
            target_balance_paise=locked_target.balance_paise,
        )

    @staticmethod
    def withdraw(
        db: Session, caller: User, req: WithdrawalRequest, idempotency_key: Optional[str] = None
    ) -> TransactionResponse:
        """Execute a withdrawal from a customer account to the external clearinghouse."""
        source_acc = db.query(Account).filter_by(id=req.source_account_id).first()
        if not source_acc or source_acc.is_system:
            TransactionService._record_attempt(
                db, caller.id, "withdrawal", req.source_account_id, None, req.amount_paise, "refused", "ACCOUNT_NOT_FOUND"
            )
            db.commit()
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source account not found.")

        if source_acc.status != "active":
            TransactionService._record_attempt(
                db, caller.id, "withdrawal", req.source_account_id, None, req.amount_paise, "refused", "ACCOUNT_FROZEN"
            )
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Source account is {source_acc.status}. Withdrawals are forbidden.",
            )

        # Permission check: Caller must be admin or member with can_withdraw
        if caller.role != "admin":
            mem = db.query(AccountMember).filter_by(account_id=source_acc.id, user_id=caller.id).first()
            if not mem or not mem.can_withdraw:
                TransactionService._record_attempt(
                    db, caller.id, "withdrawal", req.source_account_id, None, req.amount_paise, "refused", "PERMISSION_DENIED"
                )
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Caller does not have withdrawal authorization for this account.",
                )

        sys_world = TransactionService._get_system_world_account(db)

        # Deterministic Lock Ordering on Accounts
        first_id, second_id = sorted([sys_world.id, source_acc.id])
        acc1 = db.query(Account).filter_by(id=first_id).with_for_update().first()
        acc2 = db.query(Account).filter_by(id=second_id).with_for_update().first()

        locked_sys = acc1 if acc1.id == sys_world.id else acc2
        locked_source = acc1 if acc1.id == source_acc.id else acc2

        # Check balance limit: balance + overdraft >= withdrawal amount
        available = locked_source.balance_paise + locked_source.overdraft_limit_paise
        if available < req.amount_paise:
            TransactionService._record_attempt(
                db, caller.id, "withdrawal", locked_source.id, None, req.amount_paise, "refused", "INSUFFICIENT_FUNDS"
            )
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Insufficient funds. Available: ₹{available / 100:.2f}, Requested: ₹{req.amount_paise / 100:.2f}.",
            )

        # Double-entry postings: Debit Customer (-amount), Credit System World (+amount)
        postings = [
            (locked_source, -req.amount_paise),
            (locked_sys, req.amount_paise),
        ]
        tx, entries = LedgerService.post_double_entry(
            db,
            transaction_type="withdrawal",
            initiator_user_id=caller.id,
            reason=req.reason,
            postings=postings,
        )

        TransactionService._record_attempt(
            db, caller.id, "withdrawal", locked_source.id, None, req.amount_paise, "accepted", None, idempotency_key
        )
        db.commit()

        return TransactionResponse(
            transaction_id=tx.id,
            transaction_type=tx.transaction_type,
            reason=tx.reason,
            created_at=tx.created_at,
            entries=[LedgerEntryResponse.model_validate(e) for e in entries],
            source_balance_paise=locked_source.balance_paise,
        )

    @staticmethod
    def transfer(
        db: Session, caller: User, req: TransferRequest, idempotency_key: Optional[str] = None
    ) -> TransactionResponse:
        """
        Execute an atomic internal transfer between two distinct customer accounts.
        Implements Deterministic Lexicographical Lock Ordering (deadlock-free).
        """
        if req.source_account_id == req.target_account_id:
            TransactionService._record_attempt(
                db, caller.id, "transfer", req.source_account_id, req.target_account_id, req.amount_paise, "refused", "SELF_TRANSFER_REJECTED"
            )
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Source and target accounts must be distinct.",
            )

        source_acc = db.query(Account).filter_by(id=req.source_account_id).first()
        target_acc = db.query(Account).filter_by(id=req.target_account_id).first()

        if not source_acc or source_acc.is_system or not target_acc or target_acc.is_system:
            TransactionService._record_attempt(
                db, caller.id, "transfer", req.source_account_id, req.target_account_id, req.amount_paise, "refused", "ACCOUNT_NOT_FOUND"
            )
            db.commit()
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source or target account not found.")

        if source_acc.status != "active" or target_acc.status != "active":
            status_reason = f"Source ({source_acc.status})" if source_acc.status != "active" else f"Target ({target_acc.status})"
            TransactionService._record_attempt(
                db, caller.id, "transfer", req.source_account_id, req.target_account_id, req.amount_paise, "refused", "ACCOUNT_FROZEN"
            )
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Transfer rejected: {status_reason} is not active.",
            )

        # Permission check: Caller must be admin or member with can_transfer on source account
        if caller.role != "admin":
            mem = db.query(AccountMember).filter_by(account_id=source_acc.id, user_id=caller.id).first()
            if not mem or not mem.can_transfer:
                TransactionService._record_attempt(
                    db, caller.id, "transfer", req.source_account_id, req.target_account_id, req.amount_paise, "refused", "PERMISSION_DENIED"
                )
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Caller does not have transfer authorization on the source account.",
                )

        # -------------------------------------------------------------
        # CRITICAL CONCURRENCY SAFEGUARD:
        # Deterministic Lexicographical Lock Ordering (Deadlock-Free)
        # Always lock the smaller UUID first, then the larger UUID.
        # This eliminates circular wait between concurrent cross-transfers (A->B and B->A).
        # -------------------------------------------------------------
        first_id, second_id = sorted([source_acc.id, target_acc.id])
        acc1 = db.query(Account).filter_by(id=first_id).with_for_update().first()
        acc2 = db.query(Account).filter_by(id=second_id).with_for_update().first()

        locked_source = acc1 if acc1.id == source_acc.id else acc2
        locked_target = acc1 if acc1.id == target_acc.id else acc2

        # Check balance limit on source account
        available = locked_source.balance_paise + locked_source.overdraft_limit_paise
        if available < req.amount_paise:
            TransactionService._record_attempt(
                db, caller.id, "transfer", locked_source.id, locked_target.id, req.amount_paise, "refused", "INSUFFICIENT_FUNDS"
            )
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Insufficient funds. Available: ₹{available / 100:.2f}, Requested: ₹{req.amount_paise / 100:.2f}.",
            )

        # Double-entry postings: Debit Source (-amount), Credit Target (+amount)
        postings = [
            (locked_source, -req.amount_paise),
            (locked_target, req.amount_paise),
        ]
        tx, entries = LedgerService.post_double_entry(
            db,
            transaction_type="transfer",
            initiator_user_id=caller.id,
            reason=req.reason,
            postings=postings,
        )

        TransactionService._record_attempt(
            db, caller.id, "transfer", locked_source.id, locked_target.id, req.amount_paise, "accepted", None, idempotency_key
        )
        db.commit()

        return TransactionResponse(
            transaction_id=tx.id,
            transaction_type=tx.transaction_type,
            reason=tx.reason,
            created_at=tx.created_at,
            entries=[LedgerEntryResponse.model_validate(e) for e in entries],
            source_balance_paise=locked_source.balance_paise,
            target_balance_paise=locked_target.balance_paise,
        )

    @staticmethod
    def get_transaction_by_id(db: Session, caller: User, tx_id: UUID) -> TransactionResponse:
        """Inspect a ledger transaction and its entries (enforcing IDOR access controls)."""
        tx = db.query(LedgerTransaction).filter_by(id=tx_id).first()
        if not tx:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ledger transaction not found.")

        # IDOR check: Caller must be admin, auditor, or a member of at least one involved account
        if caller.role not in ("admin", "auditor"):
            involved_accounts = [e.account_id for e in tx.entries]
            has_membership = (
                db.query(AccountMember)
                .filter(AccountMember.user_id == caller.id, AccountMember.account_id.in_(involved_accounts))
                .first()
            )
            if not has_membership:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. You are not authorized to inspect this transaction.",
                )

        return TransactionResponse(
            transaction_id=tx.id,
            transaction_type=tx.transaction_type,
            reason=tx.reason,
            created_at=tx.created_at,
            entries=[LedgerEntryResponse.model_validate(e) for e in tx.entries],
        )
