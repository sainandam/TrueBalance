"""
Audit & Verification Pydantic schemas.
Defines ledger integrity verification reports, account statements,
durable attempt histories, and security audit log payloads.
"""

from datetime import datetime
from uuid import UUID
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    id: UUID
    actor_id: Optional[UUID]
    action: str
    target_type: Optional[str]
    target_id: Optional[str]
    description: Optional[str]
    details: Dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TamperedEntryDetail(BaseModel):
    account_id: UUID
    entry_id: UUID
    entry_number: int
    issue: str
    expected_hash: Optional[str] = None
    actual_hash: Optional[str] = None


class LedgerVerificationReport(BaseModel):
    is_valid: bool
    total_transactions: int
    total_entries: int
    accounts_verified: int
    global_sum_paise: int
    global_sum_is_zero: bool
    tampered_entries: List[TamperedEntryDetail]
    verified_at: datetime


class AccountStatementItem(BaseModel):
    entry_id: UUID
    transaction_id: UUID
    transaction_type: str
    amount_paise: int
    running_balance_paise: int
    reason: Optional[str]
    created_at: datetime
    entry_hash: str


class AttemptStatementItem(BaseModel):
    attempt_id: UUID
    request_type: str
    amount_paise: int
    outcome: str
    reason_code: Optional[str]
    created_at: datetime


class AccountStatementResponse(BaseModel):
    account_id: UUID
    account_number: str
    account_name: str
    currency: str
    status: str
    current_balance_paise: int
    overdraft_limit_paise: int
    entries: List[AccountStatementItem]
    refusal_attempts: List[AttemptStatementItem]
    generated_at: datetime
