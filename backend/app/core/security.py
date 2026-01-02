from datetime import datetime, timedelta
from typing import Optional, List
from jose import JWTError, jwt
from passlib.context import CryptContext
import pyotp
import qrcode
import io
import base64
import secrets

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name="ProxyDash")


def verify_totp(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    # valid_window=1 allows 1 period before and after (30 seconds each)
    # This helps with timezone issues and slight clock drift
    return totp.verify(code, valid_window=1)


def generate_qr_code_base64(uri: str) -> str:
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    return base64.b64encode(buffer.getvalue()).decode()


def generate_recovery_codes(count: int = 8) -> List[str]:
    """Generate recovery codes for 2FA backup."""
    codes = []
    for _ in range(count):
        # Format: XXXX-XXXX-XXXX (12 chars + 2 dashes)
        code = secrets.token_hex(6).upper()
        formatted = f"{code[:4]}-{code[4:8]}-{code[8:]}"
        codes.append(formatted)
    return codes


def hash_recovery_code(code: str) -> str:
    """Hash a recovery code for storage."""
    # Remove dashes for hashing
    clean_code = code.replace("-", "")
    return pwd_context.hash(clean_code)


def verify_recovery_code(code: str, hashed_code: str) -> bool:
    """Verify a recovery code against its hash."""
    clean_code = code.replace("-", "")
    return pwd_context.verify(clean_code, hashed_code)
