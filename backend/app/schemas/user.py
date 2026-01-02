from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    username: str


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    is_admin: bool
    is_approved: bool
    totp_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    requires_2fa: bool = False


class TokenWithUser(Token):
    user: UserResponse


class TOTPSetup(BaseModel):
    secret: str
    qr_code: str  # Base64 encoded QR code image
    uri: str
    recovery_codes: List[str]  # Plain text recovery codes (shown only once)


class TOTPVerify(BaseModel):
    code: str


class LoginWith2FA(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = None


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    is_approved: Optional[bool] = None


class UserCreateByAdmin(BaseModel):
    email: EmailStr
    username: str
    password: str
    is_admin: bool = False


class RecoveryCodesResponse(BaseModel):
    recovery_codes: List[str]


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class ProfileUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
