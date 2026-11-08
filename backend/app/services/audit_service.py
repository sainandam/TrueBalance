"""
Audit service providing cryptographic ledger verification, account statements
with combined postings and durable refusals, and supervisory audit log queries.
"""

from datetime import datetime, timezone
from uuid import UUID
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.account import Account
from app.models.account_member import AccountMember
from app.models.user import User
from app.models.ledger_transaction import LedgerTransaction
from app.models.ledger_entry import LedgerEntry
from app.models.transaction_attempt import TransactionAttempt
from app.models.audit_log import AuditLog
from app.schemas.audit import (
    LedgerVerificationReport,
    TamperedEntryDetail,
    AccountStatementResponse,
    AccountStatementItem,
    AttemptStatementItem,
    AuditLogResponse,
)
from app.services.ledger_service import LedgerService


class AuditService:
    @staticmethod
    def verify_ledger_integrity(
        db: Session, account_id: Optional[UUID] = None
    ) -> LedgerVerificationReport:
        """
        Cryptographic verification engine.
        Recomputes SHA-256 hash chains across all ledger entries,
        verifies balance math projection, cross-checks account balances against
        ledger sums, and enforces the global zero-sum invariant across the entire system.
        """
        tampered: List[TamperedEntryDetail] = []

        # 1. Check Global Zero-Sum Invariant across entire ledger
        global_sum = int(db.query(func.coalesce(func.sum(LedgerEntry.amount_paise), 0)).scalar() or 0)
        total_entries = int(db.query(func.count(LedgerEntry.id)).scalar() or 0)
        total_txs = int(db.query(func.count(LedgerTransaction.id)).scalar() or 0)

        # 2. Query target accounts
        acc_query = db.query(Account)
        if account_id:
            acc_query = acc_query.filter(Account.id == account_id)
        accounts = acc_query.all()

        accounts_verified = 0

        for acc in accounts:
            accounts_verified += 1
            raw_entries = (
                db.query(LedgerEntry)
                .filter(LedgerEntry.account_id == acc.id)
                .all()
            )

            if not raw_entries:
                if acc.balance_paise != 0:
                    tampered.append(
                        TamperedEntryDetail(
                            account_id=acc.id,
                            entry_id=acc.id,
                            entry_number=0,
                            issue=f"Account balance drift! accounts.balance_paise ({acc.balance_paise}) != 0 with no ledger entries.",
                        )
                    )
                continue

            # Build map by prev_hash to traverse linear chain
            by_prev = {}
            for e in raw_entries:
                if e.prev_hash in by_prev:
                    tampered.append(
                        TamperedEntryDetail(
                            account_id=acc.id,
                            entry_id=e.id,
                            entry_number=e.entry_number,
                            issue=f"Fork detected! Multiple entries point to prev_hash: {e.prev_hash}",
                        )
                    )
                by_prev[e.prev_hash] = e

            # Traverse linear chain starting from genesis (prev_hash is None)
            ordered_entries = []
            curr_prev = None
            visited_ids = set()
            while curr_prev in by_prev:
                entry = by_prev[curr_prev]
                if entry.id in visited_ids:
                    tampered.append(
                        TamperedEntryDetail(
                            account_id=acc.id,
                            entry_id=entry.id,
                            entry_number=entry.entry_number,
                            issue="Cyclic loop detected in hash chain!",
                        )
                    )
                    break
                visited_ids.add(entry.id)
                ordered_entries.append(entry)
                curr_prev = entry.entry_hash

            if len(ordered_entries) != len(raw_entries):
                for e in raw_entries:
                    if e.id not in visited_ids:
                        tampered.append(
                            TamperedEntryDetail(
                                account_id=acc.id,
                                entry_id=e.id,
                                entry_number=e.entry_number,
                                issue="Orphaned or disconnected entry detected in ledger!",
                            )
                        )

            running_balance = 0
            prev_hash: Optional[str] = None

            for entry in ordered_entries:
                # 2a. Verify previous hash pointer
                if entry.prev_hash != prev_hash:
                    tampered.append(
                        TamperedEntryDetail(
                            account_id=acc.id,
                            entry_id=entry.id,
                            entry_number=entry.entry_number,
                            issue=f"Broken hash chain: prev_hash '{entry.prev_hash}' does not match expected '{prev_hash}'",
                            expected_hash=prev_hash,
                            actual_hash=entry.prev_hash,
                        )
                    )

                # 2b. Recompute cryptographic SHA-256 fingerprint
                expected_hash = LedgerService.compute_entry_hash(
                    entry_id=entry.id,
                    tx_id=entry.ledger_transaction_id,
                    account_id=entry.account_id,
                    entry_number=entry.entry_number,
                    amount_paise=entry.amount_paise,
                    running_balance_paise=entry.running_balance_paise,
                    prev_hash=entry.prev_hash,
                )

                if entry.entry_hash != expected_hash:
                    tampered.append(
                        TamperedEntryDetail(
                            account_id=acc.id,
                            entry_id=entry.id,
                            entry_number=entry.entry_number,
                            issue="Cryptographic SHA-256 fingerprint mismatch (tampering detected)",
                            expected_hash=expected_hash,
                            actual_hash=entry.entry_hash,
                        )
                    )

                # 2c. Verify balance arithmetic
                running_balance += entry.amount_paise
                if entry.running_balance_paise != running_balance:
                    tampered.append(
                        TamperedEntryDetail(
                            account_id=acc.id,
                            entry_id=entry.id,
                            entry_number=entry.entry_number,
                            issue=f"Running balance arithmetic mismatch: expected {running_balance}, found {entry.running_balance_paise}",
                        )
                    )

                prev_hash = entry.entry_hash

            # 2d. Reconcile final account table balance against sum of ledger entries
            if acc.balance_paise != running_balance:
                tampered.append(
                    TamperedEntryDetail(
                        account_id=acc.id,
                        entry_id=acc.id,
                        entry_number=0,
                        issue=f"Account balance drift! accounts.balance_paise ({acc.balance_paise}) != sum(entries) ({running_balance})",
                    )
                )

            # 2e. Reconcile tip hash pointer if present
            if acc.last_entry_hash and acc.last_entry_hash != prev_hash:
                tampered.append(
                    TamperedEntryDetail(
                        account_id=acc.id,
                        entry_id=acc.id,
                        entry_number=0,
                        issue=f"Account tip hash drift! accounts.last_entry_hash ({acc.last_entry_hash}) != tip entry hash ({prev_hash})",
                        expected_hash=prev_hash,
                        actual_hash=acc.last_entry_hash,
                    )
                )

        is_valid = (len(tampered) == 0) and (global_sum == 0)

        # Log integrity audit event
        audit = AuditLog(
            actor_id=None,
            action="LEDGER_INTEGRITY_VERIFIED",
            target_type="ledger",
            target_id=str(account_id) if account_id else "global",
            description=f"Ledger verification completed. Valid: {is_valid}, Tampered: {len(tampered)}",
            details={
                "is_valid": is_valid,
                "global_sum_paise": global_sum,
                "tampered_count": len(tampered),
                "accounts_verified": accounts_verified,
            },
        )
        db.add(audit)
        db.commit()

        return LedgerVerificationReport(
            is_valid=is_valid,
            total_transactions=total_txs,
            total_entries=total_entries,
            accounts_verified=accounts_verified,
            global_sum_paise=global_sum,
            global_sum_is_zero=(global_sum == 0),
            tampered_entries=tampered,
            verified_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def get_account_statement(
        db: Session, caller: User, account_id: UUID
    ) -> AccountStatementResponse:
        """
        Generate account statement with IDOR verification.
        Includes both successful posted entries and durable refused attempts.
        """
        acc = db.query(Account).filter_by(id=account_id).first()
        if not acc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")

        # IDOR check: Caller must be admin, auditor, or member
        if caller.role not in ("admin", "auditor"):
            mem = db.query(AccountMember).filter_by(account_id=account_id, user_id=caller.id).first()
            if not mem or not mem.can_view:
                db.add(
                    AuditLog(
                        actor_id=caller.id,
                        action="IDOR_ACCESS_DENIED",
                        target_type="statement",
                        target_id=str(account_id),
                        description=f"User {caller.email} denied access to statement of account {acc.account_number}",
                        details={"account_id": str(account_id)},
                    )
                )
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. You do not have view authorization for this account.",
                )

        # 1. Fetch ledger entries joined with transaction
        entries = (
            db.query(LedgerEntry, LedgerTransaction)
            .join(LedgerTransaction, LedgerEntry.ledger_transaction_id == LedgerTransaction.id)
            .filter(LedgerEntry.account_id == account_id)
            .order_by(LedgerEntry.created_at.asc(), LedgerEntry.entry_number.asc())
            .all()
        )

        statement_entries = [
            AccountStatementItem(
                entry_id=entry.id,
                transaction_id=tx.id,
                transaction_type=tx.transaction_type,
                amount_paise=entry.amount_paise,
                running_balance_paise=entry.running_balance_paise,
                reason=tx.reason,
                created_at=entry.created_at,
                entry_hash=entry.entry_hash,
            )
            for entry, tx in entries
        ]

        # 2. Fetch refused transaction attempts for this account
        attempts = (
            db.query(TransactionAttempt)
            .filter(
                (TransactionAttempt.source_account_id == account_id)
                | (TransactionAttempt.target_account_id == account_id)
            )
            .order_by(TransactionAttempt.created_at.desc())
            .all()
        )

        refusals = [
            AttemptStatementItem(
                attempt_id=att.id,
                request_type=att.request_type,
                amount_paise=att.amount_paise,
                outcome=att.outcome,
                reason_code=att.reason_code,
                created_at=att.created_at,
            )
            for att in attempts
            if att.outcome == "refused"
        ]

        return AccountStatementResponse(
            account_id=acc.id,
            account_number=acc.account_number,
            account_name=acc.account_name,
            currency=acc.currency,
            status=acc.status,
            current_balance_paise=acc.balance_paise,
            overdraft_limit_paise=acc.overdraft_limit_paise,
            entries=statement_entries,
            refusal_attempts=refusals,
            generated_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def get_audit_logs(
        db: Session,
        caller: User,
        limit: int = 100,
        action: Optional[str] = None,
    ) -> List[AuditLogResponse]:
        """Query security audit logs (restricted to Admins and Auditors)."""
        if caller.role not in ("admin", "auditor"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only Admins and Auditors can inspect system audit logs.",
            )

        query = db.query(AuditLog)
        if action:
            query = query.filter(AuditLog.action == action)

        logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
        return [AuditLogResponse.model_validate(log) for log in logs]
