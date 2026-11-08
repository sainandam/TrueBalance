# LedgerLine Threat Model & Security Controls

This document tracks security threats, attack vectors, defensive architectures, automated tests proving the defense, and accepted risks.

---

### Threat 1: Direct Database Ledger Tampering
- **Category**: Data Integrity / Tamper Resistance
- **Threat Description**: An attacker or rogue process gaining SQL execution privileges attempts to retroactively alter past ledger entries (`ledger_entries`), manipulate transaction amounts, or delete records to hide fraudulent money movement.
- **Attack Vector**: Attacker runs `UPDATE ledger_entries SET amount_paise = 9999999 WHERE id = '...'` or `DELETE FROM ledger_entries WHERE id = '...'`.
- **Engineering Defense**: 
  1. PostgreSQL triggers `trg_protect_ledger_entries`, `trg_protect_ledger_transactions`, and `trg_protect_audit_logs` are installed directly at the database engine level via migration `e6acf3cc1d11`.
  2. The trigger functions (`prevent_ledger_entry_mutation()`, `prevent_ledger_transaction_mutation()`, `prevent_audit_log_mutation()`) intercept any `UPDATE` or `DELETE` statement before execution and immediately raise a PL/pgSQL exception (`RAISE EXCEPTION '... are immutable. UPDATE or DELETE operations are strictly forbidden.'`), terminating the query and rolling back the transaction.
- **Automated Verification Test**: `backend/tests/test_db_immutability.py`
  - `test_audit_logs_mutation_blocked_by_trigger` (PASSED)
  - `test_ledger_transactions_mutation_blocked_by_trigger` (PASSED)
  - `test_ledger_entries_mutation_blocked_by_trigger` (PASSED)
- **Remaining Accepted Risk**: A database superuser (`postgres` or Cloud admin) can theoretically drop the trigger. To counter this, periodic independent cryptographic SHA-256 hash chains across `ledger_entries` are verified and audited against independent audit checkpoints.

---

### Threat 2: Overdraft via Negative Balance Manipulation
- **Category**: Financial Integrity
- **Threat Description**: An account balance is manipulated to drop below zero (or below overdraft limit).
- **Attack Vector**: Rapid balance deductions or malicious API payloads causing balance to become negative.
- **Engineering Defense**:
  1. Database CheckConstraint `ck_accounts_overdraft`: `balance_paise >= -overdraft_limit_paise`.
  2. Database CheckConstraint `ck_accounts_overdraft_nonnegative`: `overdraft_limit_paise >= 0`.
  3. Database CheckConstraint `ck_ledger_entries_nonzero_amount`: `amount_paise <> 0`.
- **Automated Verification Test**: Verified via migration `e6acf3cc1d11` and covered in concurrency test suites.
- **Remaining Accepted Risk**: None at the database layer; invalid updates are rejected by PostgreSQL kernel.
