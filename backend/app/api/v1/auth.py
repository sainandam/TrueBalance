from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.security.deps import get_db, get_current_user, require_roles, security
from app.models.user import User
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    LoginResponse,
    MessageResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication & Sessions"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
def register(
    req: UserRegisterRequest,
    db: Session = Depends(get_db),
):
    """Register a new user account with Argon2id password hashing."""
    return AuthService.register_user(db, req)


@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="User login and session creation",
)
def login(
    req: UserLoginRequest,
    db: Session = Depends(get_db),
):
    """Authenticate with email and password, creating a secure revocable session."""
    return AuthService.login_user(db, req)


@router.post(
    "/logout",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Revoke current session",
)
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke the caller's session token."""
    raw_token = credentials.credentials
    AuthService.logout_user(db, raw_token, current_user)
    return MessageResponse(message="Successfully logged out and session revoked.")


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile",
)
def get_me(current_user: User = Depends(get_current_user)):
    """Return identity and roles of the authenticated session."""
    return UserResponse.model_validate(current_user)


@router.get(
    "/admin-only",
    response_model=MessageResponse,
    summary="Admin role authorization test endpoint",
)
def admin_only_endpoint(admin_user: User = Depends(require_roles("admin"))):
    """Demonstrates RBAC: Accessible only by users with 'admin' role."""
    return MessageResponse(message=f"Welcome Admin {admin_user.full_name}!")


@router.get(
    "/auditor-only",
    response_model=MessageResponse,
    summary="Auditor role authorization test endpoint",
)
def auditor_only_endpoint(auditor_user: User = Depends(require_roles("auditor"))):
    """Demonstrates RBAC: Accessible only by users with 'auditor' role."""
    return MessageResponse(message=f"Welcome Auditor {auditor_user.full_name}!")
