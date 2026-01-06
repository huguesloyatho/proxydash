"""
Authentication API routes.
"""

import json
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    generate_totp_secret, get_totp_uri, verify_totp, generate_qr_code_base64,
    generate_recovery_codes, hash_recovery_code, verify_recovery_code
)
from app.core.config import settings
from app.models import User, AuditAction
from app.schemas import (
    UserCreate, UserResponse, Token, TokenWithUser,
    TOTPSetup, TOTPVerify, LoginWith2FA, RecoveryCodesResponse,
    PasswordChange, ProfileUpdate
)
from app.api.deps import get_current_user
from app.services.audit_service import AuditService
from app.services.session_service import SessionService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user. First user becomes admin and is auto-approved."""
    # Check if email already exists
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email déjà utilisé"
        )

    # Check if username already exists
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nom d'utilisateur déjà utilisé"
        )

    # First user is admin and auto-approved
    is_first_user = db.query(User).count() == 0

    user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        is_admin=is_first_user,
        is_active=True,
        is_approved=is_first_user,  # Only first user is auto-approved
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/login", response_model=TokenWithUser)
async def login(credentials: LoginWith2FA, request: Request, db: Session = Depends(get_db)):
    """Login with email and password. Returns JWT token."""
    audit = AuditService(db)
    user = db.query(User).filter(User.email == credentials.email).first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        audit.log_from_request(
            request=request,
            action=AuditAction.LOGIN_FAILED,
            user_id=user.id if user else None,
            details={"email": credentials.email},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé"
        )

    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte en attente de validation par un administrateur"
        )

    # Check 2FA if enabled
    if user.totp_enabled:
        if not credentials.totp_code:
            # Return a special response indicating 2FA is required
            return TokenWithUser(
                access_token="",
                requires_2fa=True,
                user=UserResponse.model_validate(user)
            )

        # Try TOTP code first
        totp_valid = verify_totp(user.totp_secret, credentials.totp_code)

        # If TOTP fails, try recovery code
        recovery_valid = False
        if not totp_valid and user.recovery_codes:
            recovery_codes = json.loads(user.recovery_codes)
            for i, hashed_code in enumerate(recovery_codes):
                if verify_recovery_code(credentials.totp_code, hashed_code):
                    # Remove used recovery code
                    recovery_codes.pop(i)
                    user.recovery_codes = json.dumps(recovery_codes)
                    db.commit()
                    recovery_valid = True
                    break

        if not totp_valid and not recovery_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Code 2FA incorrect"
            )

    # Generate token
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    # Create session
    session_service = SessionService(db)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("User-Agent")
    session_service.create_session(
        user_id=user.id,
        token=access_token,
        ip_address=client_ip,
        user_agent=user_agent,
        expires_in_hours=max(settings.ACCESS_TOKEN_EXPIRE_MINUTES // 60, 1),
    )

    # Log successful login
    audit.log_from_request(
        request=request,
        action=AuditAction.LOGIN,
        user_id=user.id,
    )

    return TokenWithUser(
        access_token=access_token,
        requires_2fa=False,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return current_user


@router.post("/2fa/setup", response_model=TOTPSetup)
async def setup_2fa(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate TOTP secret and QR code for 2FA setup."""
    if current_user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA déjà activé"
        )

    # Generate new secret
    secret = generate_totp_secret()
    uri = get_totp_uri(secret, current_user.email)
    qr_code = generate_qr_code_base64(uri)

    # Generate recovery codes
    recovery_codes = generate_recovery_codes(8)
    hashed_codes = [hash_recovery_code(code) for code in recovery_codes]

    # Store secret and hashed recovery codes (not enabled yet)
    current_user.totp_secret = secret
    current_user.recovery_codes = json.dumps(hashed_codes)
    db.commit()

    return TOTPSetup(secret=secret, qr_code=qr_code, uri=uri, recovery_codes=recovery_codes)


@router.post("/2fa/verify")
async def verify_2fa(
    data: TOTPVerify,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify TOTP code and enable 2FA."""
    if current_user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA déjà activé"
        )

    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configurez d'abord le 2FA avec /2fa/setup"
        )

    if not verify_totp(current_user.totp_secret, data.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code invalide"
        )

    current_user.totp_enabled = True
    db.commit()

    return {"message": "2FA activé avec succès"}


@router.post("/2fa/disable")
async def disable_2fa(
    data: TOTPVerify,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disable 2FA after verifying current code."""
    if not current_user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA non activé"
        )

    if not verify_totp(current_user.totp_secret, data.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code invalide"
        )

    current_user.totp_enabled = False
    current_user.totp_secret = None
    current_user.recovery_codes = None
    db.commit()

    return {"message": "2FA désactivé avec succès"}


@router.post("/2fa/regenerate-recovery", response_model=RecoveryCodesResponse)
async def regenerate_recovery_codes(
    data: TOTPVerify,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Regenerate recovery codes (requires current TOTP code)."""
    if not current_user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA non activé"
        )

    if not verify_totp(current_user.totp_secret, data.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code invalide"
        )

    # Generate new recovery codes
    recovery_codes = generate_recovery_codes(8)
    hashed_codes = [hash_recovery_code(code) for code in recovery_codes]
    current_user.recovery_codes = json.dumps(hashed_codes)
    db.commit()

    return RecoveryCodesResponse(recovery_codes=recovery_codes)


@router.patch("/profile", response_model=UserResponse)
async def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user profile (email, username)."""
    # Check email uniqueness
    if data.email and data.email != current_user.email:
        if db.query(User).filter(User.email == data.email).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email déjà utilisé"
            )
        current_user.email = data.email

    # Check username uniqueness
    if data.username and data.username != current_user.username:
        if db.query(User).filter(User.username == data.username).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nom d'utilisateur déjà utilisé"
            )
        current_user.username = data.username

    db.commit()
    db.refresh(current_user)

    return current_user


@router.post("/change-password")
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change current user password."""
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe actuel incorrect"
        )

    if len(data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nouveau mot de passe doit contenir au moins 6 caractères"
        )

    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()

    return {"message": "Mot de passe modifié avec succès"}
