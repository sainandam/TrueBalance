"""
Test suite to prove that PostgreSQL database triggers reject any UPDATE or DELETE
operations on immutable tables (ledger_entries, ledger_transactions, audit_logs).
"""

from uuid import uuid4
import pytest
from sqlalchemy import text


def test_audit_logs_mutation_blocked_by_trigger(db_conn):
    """Verify that UPDATE and DELETE on audit_logs are blocked at the PostgreSQL engine level."""
    test_id = str(uuid4())

    try:
        # Insert audit record
        db_conn.execute(
            text("INSERT INTO audit_logs (id, action, details) VALUES (:id, 'TEST_LOG', '{}')"),
            {"id": test_id},
        )

        # Attempt UPDATE within savepoint -> trigger raises exception, savepoint rolls back
        with pytest.raises(Exception) as exc_info:
            with db_conn.begin_nested():
                db_conn.execute(
                    text("UPDATE audit_logs SET action = 'TAMPERED' WHERE id = :id"),
                    {"id": test_id},
                )
        assert "Audit logs are immutable" in str(exc_info.value)

        # Attempt DELETE within savepoint -> trigger raises exception, savepoint rolls back
        with pytest.raises(Exception) as exc_info:
            with db_conn.begin_nested():
                db_conn.execute(
                    text("DELETE FROM audit_logs WHERE id = :id"),
                    {"id": test_id},
                )
        assert "Audit logs are immutable" in str(exc_info.value)
    finally:
        # Rollback outer transaction so nothing is committed to the database
        db_conn.rollback()


def test_ledger_transactions_mutation_blocked_by_trigger(db_conn):
    """Verify that UPDATE and DELETE on ledger_transactions are blocked at the DB engine level."""
    tx_id = str(uuid4())

    try:
        db_conn.execute(
            text("INSERT INTO ledger_transactions (id, transaction_type, reason) VALUES (:id, 'deposit', 'Initial test deposit')"),
            {"id": tx_id},
        )

        # Attempt UPDATE
        with pytest.raises(Exception) as exc_info:
            with db_conn.begin_nested():
                db_conn.execute(
                    text("UPDATE ledger_transactions SET reason = 'TAMPERED' WHERE id = :id"),
                    {"id": tx_id},
                )
        assert "Ledger transactions are immutable" in str(exc_info.value)

        # Attempt DELETE
        with pytest.raises(Exception) as exc_info:
            with db_conn.begin_nested():
                db_conn.execute(
                    text("DELETE FROM ledger_transactions WHERE id = :id"),
                    {"id": tx_id},
                )
        assert "Ledger transactions are immutable" in str(exc_info.value)
    finally:
        db_conn.rollback()


def test_ledger_entries_mutation_blocked_by_trigger(db_conn):
    """Verify that UPDATE and DELETE on ledger_entries are blocked at the DB engine level."""
    tx_id = str(uuid4())
    entry_id = str(uuid4())

    try:
        # Get existing account
        account_id = db_conn.execute(text("SELECT id FROM accounts LIMIT 1")).scalar()
        assert account_id is not None

        # Insert transaction header
        db_conn.execute(
            text("INSERT INTO ledger_transactions (id, transaction_type, reason) VALUES (:id, 'deposit', 'Initial test deposit')"),
            {"id": tx_id},
        )

        # Insert ledger entry
        db_conn.execute(
            text("""
                INSERT INTO ledger_entries (id, ledger_transaction_id, account_id, entry_number, amount_paise, running_balance_paise, entry_hash)
                VALUES (:id, :tx_id, :acc_id, 1, 10000, 10000, 'mock_hash_entry_1')
            """),
            {"id": entry_id, "tx_id": tx_id, "acc_id": account_id},
        )

        # Attempt UPDATE on ledger_entry
        with pytest.raises(Exception) as exc_info:
            with db_conn.begin_nested():
                db_conn.execute(
                    text("UPDATE ledger_entries SET amount_paise = 9999999 WHERE id = :id"),
                    {"id": entry_id},
                )
        assert "Ledger entries are immutable" in str(exc_info.value)

        # Attempt DELETE on ledger_entry
        with pytest.raises(Exception) as exc_info:
            with db_conn.begin_nested():
                db_conn.execute(
                    text("DELETE FROM ledger_entries WHERE id = :id"),
                    {"id": entry_id},
                )
        assert "Ledger entries are immutable" in str(exc_info.value)
    finally:
        db_conn.rollback()
