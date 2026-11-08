from datetime import datetime
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, EmailStr


class AccountCreateRequest(BaseModel):
    account_name: str = Field(..., min_length=2, max_length=120)
    currency: str = Field("INR", min_length=3, max_length=3)
    overdraft_limit_paise: int = Field(0, ge=0)


class AccountResponse(BaseModel):
    id: UUID
    account_number: str
    account_name: str
    currency: str
    balance_paise: int
    overdraft_limit_paise: int
    status: str
    is_system: bool
    created_at: datetime
    current_user_role: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AccountMemberAddRequest(BaseModel):
    user_email: EmailStr
    member_role: str = Field("viewer", pattern="^(owner|operator|viewer)$")
    can_view: bool = True
    can_deposit: bool = False
    can_withdraw: bool = False
    can_transfer: bool = False


class AccountMemberResponse(BaseModel):
    account_id: UUID
    user_id: UUID
    user_email: str
    user_full_name: str
    member_role: str
    can_view: bool
    can_deposit: bool
    can_withdraw: bool
    can_transfer: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AccountStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(active|frozen|closed)$")
    reason: Optional[str] = Field(None, max_length=255)

