"""
Authentication and session service implementing Argon2id hashing,
secure session creation, revocations, and audit logging.
"""

from datetime import datetime, timezone
from uuid import uuid4
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.session import UserSession
from app.models.audit_log import AuditLog
from app.schemas.auth import UserRegisterRequest, UserLoginRequest, LoginResponse, UserResponse
from app.security.password import hash_password, verify_password
from app.security.session import generate_session_token, hash_session_token, calculate_session_expiry


class AuthService:
    @staticmethod
    def register_user(db: Session, req: UserRegisterRequest) -> UserResponse:
        """Register a new user with Argon2id password hash and emit an audit log."""
        existing = db.query(User).filter(User.email == req.email.lower().strip()).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"An account with email '{req.email}' already exists.",
            )

        # Enforce valid role assignment
        assigned_role = req.role if req.role in ("admin", "holder", "auditor") else "holder"

        new_user = User(
            id=uuid4(),
            email=req.email.lower().strip(),
            full_name=req.full_name.strip(),
            password_hash=hash_password(req.password),
            role=assigned_role,
            status="active",
        )
        db.add(new_user)
        db.flush()

        # Audit log for user registration
        audit_entry = AuditLog(
            id=uuid4(),
            actor_id=new_user.id,
            action="USER_REGISTERED",
            target_type="user",
            target_id=str(new_user.id),
            description=f"New user registered: {new_user.email} with role {new_user.role}",
            details={"email": new_user.email, "role": new_user.role},
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(new_user)

        return UserResponse.model_validate(new_user)

    @staticmethod
    def login_user(db: Session, req: UserLoginRequest) -> LoginResponse:
        """Authenticate user credentials, issue a revocable session token, and record audit log."""
        email = req.email.lower().strip()
        user = db.query(User).filter(User.email == email).first()

        if not user or not verify_password(req.password, user.password_hash):
            # Record failed login in audit trail
            audit = AuditLog(
                id=uuid4(),
                actor_id=user.id if user else None,
                action="AUTH_LOGIN_FAILED",
                target_type="user",
                target_id=str(user.id) if user else None,
                description=f"Failed login attempt for email: {email}",
                details={"email": email, "reason": "invalid_credentials"},
            )
            db.add(audit)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if user.status != "active":
            audit = AuditLog(
                id=uuid4(),
                actor_id=user.id,
                action="AUTH_LOGIN_REJECTED",
                target_type="user",
                target_id=str(user.id),
                description=f"Login rejected for disabled user: {email}",
                details={"email": email, "reason": "user_inactive"},
            )
            db.add(audit)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive or disabled. Contact administrator.",
            )

        # Issue 256-bit cryptographically secure session token
        raw_token = generate_session_token()
        token_hash = hash_session_token(raw_token)
        expires_at = calculate_session_expiry()

        session_record = UserSession(
            id=uuid4(),
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        db.add(session_record)

        audit = AuditLog(
            id=uuid4(),
            actor_id=user.id,
            action="AUTH_LOGIN_SUCCESS",
            target_type="user",
            target_id=str(user.id),
            description=f"Successful login for user: {email}",
            details={"email": email, "session_id": str(session_record.id)},
        )
        db.add(audit)
        db.commit()

        return LoginResponse(
            token=raw_token,
            token_type="Bearer",
            expires_at=expires_at,
            user=UserResponse.model_validate(user),
        )

    @staticmethod
    def logout_user(db: Session, raw_token: str, user: User) -> None:
        """Revoke active session token and log the event."""
        token_hash = hash_session_token(raw_token)
        session_record = (
            db.query(UserSession)
            .filter(
                UserSession.token_hash == token_hash,
                UserSession.user_id == user.id,
                UserSession.revoked_at.is_(None),
            )
            .first()
        )

        if session_record:
            session_record.revoked_at = datetime.now(timezone.utc)
            audit = AuditLog(
                id=uuid4(),
                actor_id=user.id,
                action="AUTH_LOGOUT_SUCCESS",
                target_type="user_session",
                target_id=str(session_record.id),
                description=f"Session revoked for user: {user.email}",
                details={"session_id": str(session_record.id)},
            )
            db.add(audit)
            db.commit()

