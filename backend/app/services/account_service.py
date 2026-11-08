"""
Account service implementing account creation, ownership verification,
strict IDOR protections, member delegation, and administrative lifecycle controls.
"""

import secrets
from typing import List, Optional
from uuid import UUID, uuid4
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.account_member import AccountMember
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.account import (
    AccountCreateRequest,
    AccountResponse,
    AccountMemberAddRequest,
    AccountMemberResponse,
    AccountStatusUpdateRequest,
)


class AccountService:
    @staticmethod
    def _generate_unique_account_number(db: Session) -> str:
        """Generate a random 10-digit collision-resistant account number (e.g. ACC-12345678)."""
        for _ in range(10):
            candidate = f"ACC-{secrets.randbelow(90000000) + 10000000}"
            exists = db.query(Account).filter(Account.account_number == candidate).first()
            if not exists:
                return candidate
        raise RuntimeError("Failed to generate a unique account number after multiple attempts.")

    @staticmethod
    def create_account(db: Session, user: User, req: AccountCreateRequest) -> AccountResponse:
        """Create a new account and establish the creator as the primary Owner."""
        # Security rule: Non-admin users cannot grant themselves overdraft limits
        if req.overdraft_limit_paise > 0 and user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only system administrators are authorized to assign non-zero overdraft limits.",
            )

        account_number = AccountService._generate_unique_account_number(db)
        new_account = Account(
            id=uuid4(),
            account_number=account_number,
            account_name=req.account_name.strip(),
            currency=req.currency.upper(),
            balance_paise=0,
            overdraft_limit_paise=req.overdraft_limit_paise,
            status="active",
            is_system=False,
        )
        db.add(new_account)
        db.flush()

        # Automatically assign creator as Owner with full permissions
        membership = AccountMember(
            account_id=new_account.id,
            user_id=user.id,
            member_role="owner",
            can_view=True,
            can_deposit=True,
            can_withdraw=True,
            can_transfer=True,
        )
        db.add(membership)

        # Audit trail
        audit = AuditLog(
            id=uuid4(),
            actor_id=user.id,
            action="ACCOUNT_CREATED",
            target_type="account",
            target_id=str(new_account.id),
            description=f"Account '{new_account.account_name}' ({new_account.account_number}) created by {user.email}",
            details={
                "account_number": new_account.account_number,
                "overdraft_limit_paise": new_account.overdraft_limit_paise,
            },
        )
        db.add(audit)
        db.commit()
        db.refresh(new_account)

        resp = AccountResponse.model_validate(new_account)
        resp.current_user_role = "owner"
        return resp

    @staticmethod
    def get_user_accounts(db: Session, user: User) -> List[AccountResponse]:
        """List accounts accessible to the current user (IDOR prevention)."""
        if user.role in ("admin", "auditor"):
            # Admins & Auditors can view all non-system accounts
            accounts = db.query(Account).filter(Account.is_system == False).all()  # noqa: E712
            results = []
            for acc in accounts:
                r = AccountResponse.model_validate(acc)
                # Check if caller has explicit membership
                mem = db.query(AccountMember).filter_by(account_id=acc.id, user_id=user.id).first()
                r.current_user_role = mem.member_role if mem else user.role
                results.append(r)
            return results

        # Holders only see accounts where they are active members
        memberships = (
            db.query(AccountMember)
            .filter(AccountMember.user_id == user.id, AccountMember.can_view == True)  # noqa: E712
            .all()
        )
        results = []
        for mem in memberships:
            acc = db.query(Account).filter_by(id=mem.account_id).first()
            if acc and not acc.is_system:
                r = AccountResponse.model_validate(acc)
                r.current_user_role = mem.member_role
                results.append(r)
        return results

    @staticmethod
    def get_account_by_id(db: Session, user: User, account_id: UUID) -> AccountResponse:
        """Fetch account details with strict IDOR verification."""
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Financial account not found.",
            )

        # IDOR check: Is user authorized?
        if user.role in ("admin", "auditor"):
            mem = db.query(AccountMember).filter_by(account_id=account.id, user_id=user.id).first()
            r = AccountResponse.model_validate(account)
            r.current_user_role = mem.member_role if mem else user.role
            return r

        # Regular holder check
        mem = db.query(AccountMember).filter_by(account_id=account.id, user_id=user.id).first()
        if not mem or not mem.can_view:
            # Audit unauthorized access attempt
            audit = AuditLog(
                id=uuid4(),
                actor_id=user.id,
                action="IDOR_ACCESS_DENIED",
                target_type="account",
                target_id=str(account.id),
                description=f"User {user.email} attempted unauthorized read on account {account.account_number}",
                details={"account_id": str(account.id)},
            )
            db.add(audit)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not have view permissions for this account.",
            )

        r = AccountResponse.model_validate(account)
        r.current_user_role = mem.member_role
        return r

    @staticmethod
    def add_account_member(
        db: Session, caller: User, account_id: UUID, req: AccountMemberAddRequest
    ) -> AccountMemberResponse:
        """Add or update an account member (restricted to account owners or system admins)."""
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Financial account not found.",
            )

        # Authorization: Caller must be Admin or Owner of this account
        if caller.role != "admin":
            caller_mem = db.query(AccountMember).filter_by(account_id=account.id, user_id=caller.id).first()
            if not caller_mem or caller_mem.member_role != "owner":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the account owner or an administrator can manage account members.",
                )

        target_user = db.query(User).filter(User.email == req.user_email.lower().strip()).first()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with email '{req.user_email}' does not exist.",
            )

        member = db.query(AccountMember).filter_by(account_id=account.id, user_id=target_user.id).first()
        if not member:
            member = AccountMember(
                account_id=account.id,
                user_id=target_user.id,
                member_role=req.member_role,
                can_view=req.can_view,
                can_deposit=req.can_deposit,
                can_withdraw=req.can_withdraw,
                can_transfer=req.can_transfer,
            )
            db.add(member)
        else:
            member.member_role = req.member_role
            member.can_view = req.can_view
            member.can_deposit = req.can_deposit
            member.can_withdraw = req.can_withdraw
            member.can_transfer = req.can_transfer

        audit = AuditLog(
            id=uuid4(),
            actor_id=caller.id,
            action="ACCOUNT_MEMBER_MANAGED",
            target_type="account",
            target_id=str(account.id),
            description=f"Member {target_user.email} assigned role '{req.member_role}' on account {account.account_number}",
            details={
                "target_user_id": str(target_user.id),
                "member_role": req.member_role,
                "can_transfer": req.can_transfer,
            },
        )
        db.add(audit)
        db.commit()
        db.refresh(member)

        return AccountMemberResponse(
            account_id=account.id,
            user_id=target_user.id,
            user_email=target_user.email,
            user_full_name=target_user.full_name,
            member_role=member.member_role,
            can_view=member.can_view,
            can_deposit=member.can_deposit,
            can_withdraw=member.can_withdraw,
            can_transfer=member.can_transfer,
            created_at=member.created_at,
        )

    @staticmethod
    def list_account_members(db: Session, caller: User, account_id: UUID) -> List[AccountMemberResponse]:
        """List members of an account (restricted to members, admins, and auditors)."""
        AccountService.get_account_by_id(db, caller, account_id)  # Enforces IDOR check

        memberships = db.query(AccountMember).filter_by(account_id=account_id).all()
        results = []
        for mem in memberships:
            u = mem.user
            results.append(
                AccountMemberResponse(
                    account_id=mem.account_id,
                    user_id=u.id,
                    user_email=u.email,
                    user_full_name=u.full_name,
                    member_role=mem.member_role,
                    can_view=mem.can_view,
                    can_deposit=mem.can_deposit,
                    can_withdraw=mem.can_withdraw,
                    can_transfer=mem.can_transfer,
                    created_at=mem.created_at,
                )
            )
        return results

    @staticmethod
    def update_account_status(
        db: Session, admin_user: User, account_id: UUID, req: AccountStatusUpdateRequest
    ) -> AccountResponse:
        """Admin-only lifecycle control: freeze, unfreeze, or close an account."""
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Financial account not found.",
            )
        if account.is_system:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="System clearinghouse accounts cannot be modified or frozen.",
            )

        old_status = account.status
        account.status = req.status

        audit = AuditLog(
            id=uuid4(),
            actor_id=admin_user.id,
            action="ACCOUNT_STATUS_CHANGED",
            target_type="account",
            target_id=str(account.id),
            description=f"Account {account.account_number} status changed from {old_status} to {req.status}",
            details={
                "old_status": old_status,
                "new_status": req.status,
                "reason": req.reason,
            },
        )
        db.add(audit)
        db.commit()
        db.refresh(account)

        return AccountResponse.model_validate(account)
