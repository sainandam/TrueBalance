"""
Double-entry ledger engine enforcing the zero-sum invariant (sum of amounts = 0),
cryptographic SHA-256 hash-chaining, and atomic balance projections.
"""

import hashlib
from typing import List, Tuple, Optional
from uuid import UUID, uuid4
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.account import Account
from app.models.ledger_transaction import LedgerTransaction
from app.models.ledger_entry import LedgerEntry


class LedgerService:
    @staticmethod
    def compute_entry_hash(
        entry_id: UUID,
        tx_id: UUID,
        account_id: UUID,
        entry_number: int,
        amount_paise: int,
        running_balance_paise: int,
        prev_hash: Optional[str],
    ) -> str:
        """Compute cryptographic SHA-256 fingerprint for a ledger entry."""
        payload = (
            f"{entry_id}:{tx_id}:{account_id}:{entry_number}:"
            f"{amount_paise}:{running_balance_paise}:{prev_hash or 'GENESIS'}"
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @staticmethod
    def get_last_entry(db: Session, account_id: UUID) -> Optional[LedgerEntry]:
        """Fetch the most recent ledger entry for an account to retrieve the previous hash."""
        return (
            db.query(LedgerEntry)
            .filter(LedgerEntry.account_id == account_id)
            .order_by(desc(LedgerEntry.created_at), desc(LedgerEntry.entry_number))
            .first()
        )

    @staticmethod
    def post_double_entry(
        db: Session,
        transaction_type: str,
        initiator_user_id: Optional[UUID],
        reason: Optional[str],
        postings: List[Tuple[Account, int]],  # (locked_account, delta_paise)
    ) -> Tuple[LedgerTransaction, List[LedgerEntry]]:
        """
        Atomically post balanced ledger entries and update projected account balances.
        
        Strict Invariant:
        Sum of all amount_paise across postings must strictly equal 0.
        """
        # 1. Enforce Zero-Sum Balance Invariant
        net_movement = sum(amount for _, amount in postings)
        if net_movement != 0:
            raise ValueError(
                f"Double-entry bookkeeping invariant violated! Net sum of entries must be 0, but got {net_movement} paise."
            )

        if len(postings) < 2:
            raise ValueError("A double-entry transaction must contain at least two balancing entries.")

        # 2. Create Header
        tx = LedgerTransaction(
            id=uuid4(),
            transaction_type=transaction_type,
            initiator_user_id=initiator_user_id,
            reason=reason,
        )
        db.add(tx)
        db.flush()

        # 3. Create Balanced Entries with Cryptographic Hash Chains
        created_entries = []
        for idx, (account, amount_paise) in enumerate(postings, start=1):
            if amount_paise == 0:
                raise ValueError("Ledger entry amount cannot be zero.")

            last_entry = LedgerService.get_last_entry(db, account.id)
            prev_hash = last_entry.entry_hash if last_entry else None

            # Projected new running balance
            new_running_balance = account.balance_paise + amount_paise
            entry_id = uuid4()
            entry_hash = LedgerService.compute_entry_hash(
                entry_id=entry_id,
                tx_id=tx.id,
                account_id=account.id,
                entry_number=idx,
                amount_paise=amount_paise,
                running_balance_paise=new_running_balance,
                prev_hash=prev_hash,
            )

            entry = LedgerEntry(
                id=entry_id,
                ledger_transaction_id=tx.id,
                account_id=account.id,
                entry_number=idx,
                amount_paise=amount_paise,
                running_balance_paise=new_running_balance,
                prev_hash=prev_hash,
                entry_hash=entry_hash,
            )
            db.add(entry)
            created_entries.append(entry)

            # Update account projected balance
            account.balance_paise = new_running_balance

        db.flush()
        return tx, created_entries
