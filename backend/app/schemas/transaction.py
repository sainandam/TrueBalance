from datetime import datetime
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class DepositRequest(BaseModel):
    target_account_id: UUID
    amount_paise: int = Field(..., gt=0, description="Amount in integer paise (e.g. 10000 = ₹100.00)")
    reason: Optional[str] = Field("External cash deposit", max_length=255)


class WithdrawalRequest(BaseModel):
    source_account_id: UUID
    amount_paise: int = Field(..., gt=0, description="Amount in integer paise (e.g. 5000 = ₹50.00)")
    reason: Optional[str] = Field("External cash withdrawal", max_length=255)


class TransferRequest(BaseModel):
    source_account_id: UUID
    target_account_id: UUID
    amount_paise: int = Field(..., gt=0, description="Amount in integer paise")
    reason: Optional[str] = Field("Account transfer", max_length=255)


class LedgerEntryResponse(BaseModel):
    id: UUID
    account_id: UUID
    entry_number: int
    amount_paise: int
    running_balance_paise: int
    prev_hash: Optional[str]
    entry_hash: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TransactionResponse(BaseModel):
    transaction_id: UUID
    transaction_type: str
    reason: Optional[str]
    created_at: datetime
    entries: List[LedgerEntryResponse]
    source_balance_paise: Optional[int] = None
    target_balance_paise: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
