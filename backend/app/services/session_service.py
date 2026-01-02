"""
Session Service for managing user sessions.
"""

import hashlib
import logging
from datetime import datetime, timedelta
from typing import List, Optional
from user_agents import parse as parse_user_agent

from sqlalchemy.orm import Session

from app.models.user_session import UserSession

logger = logging.getLogger(__name__)


class SessionService:
    """Service for managing user sessions."""

    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def hash_token(token: str) -> str:
        """Create SHA256 hash of a token."""
        return hashlib.sha256(token.encode()).hexdigest()

    @staticmethod
    def parse_device_info(user_agent_str: Optional[str]) -> str:
        """Parse user agent to get device info."""
        if not user_agent_str:
            return "Unknown device"

        try:
            ua = parse_user_agent(user_agent_str)
            browser = f"{ua.browser.family} {ua.browser.version_string}".strip()
            os = f"{ua.os.family} {ua.os.version_string}".strip()
            device = ua.device.family

            if device and device != "Other":
                return f"{browser} on {device} ({os})"
            return f"{browser} on {os}"
        except Exception:
            return user_agent_str[:100] if user_agent_str else "Unknown device"

    def create_session(
        self,
        user_id: int,
        token: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        expires_in_hours: int = 24,
    ) -> UserSession:
        """
        Create a new session for a user.

        Args:
            user_id: User ID
            token: JWT token
            ip_address: Client IP
            user_agent: Client user agent
            expires_in_hours: Session expiration time

        Returns:
            Created UserSession
        """
        token_hash = self.hash_token(token)
        device_info = self.parse_device_info(user_agent)

        session = UserSession(
            user_id=user_id,
            token_hash=token_hash,
            device_info=device_info,
            ip_address=ip_address,
            user_agent=user_agent[:500] if user_agent else None,
            expires_at=datetime.utcnow() + timedelta(hours=expires_in_hours),
        )

        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)

        logger.info(f"Created session for user {user_id} from {ip_address}")
        return session

    def get_user_sessions(self, user_id: int, include_expired: bool = False) -> List[UserSession]:
        """Get all sessions for a user."""
        query = self.db.query(UserSession).filter(
            UserSession.user_id == user_id,
            UserSession.is_active == True,
        )

        if not include_expired:
            query = query.filter(UserSession.expires_at > datetime.utcnow())

        return query.order_by(UserSession.last_activity.desc()).all()

    def get_session_by_token(self, token: str) -> Optional[UserSession]:
        """Get session by token."""
        token_hash = self.hash_token(token)
        return self.db.query(UserSession).filter(
            UserSession.token_hash == token_hash,
            UserSession.is_active == True,
        ).first()

    def validate_session(self, token: str) -> Optional[UserSession]:
        """Validate a session and update last activity."""
        session = self.get_session_by_token(token)

        if not session or not session.is_valid:
            return None

        # Update last activity
        session.last_activity = datetime.utcnow()
        self.db.commit()

        return session

    def revoke_session(self, session_id: int, user_id: int) -> bool:
        """
        Revoke a specific session.

        Args:
            session_id: Session to revoke
            user_id: User ID (for verification)

        Returns:
            True if revoked, False if not found
        """
        session = self.db.query(UserSession).filter(
            UserSession.id == session_id,
            UserSession.user_id == user_id,
            UserSession.is_active == True,
        ).first()

        if not session:
            return False

        session.is_active = False
        session.revoked_at = datetime.utcnow()
        self.db.commit()

        logger.info(f"Revoked session {session_id} for user {user_id}")
        return True

    def revoke_all_sessions(self, user_id: int, except_token: Optional[str] = None) -> int:
        """
        Revoke all sessions for a user.

        Args:
            user_id: User ID
            except_token: Token to keep active (current session)

        Returns:
            Number of revoked sessions
        """
        query = self.db.query(UserSession).filter(
            UserSession.user_id == user_id,
            UserSession.is_active == True,
        )

        if except_token:
            except_hash = self.hash_token(except_token)
            query = query.filter(UserSession.token_hash != except_hash)

        sessions = query.all()
        count = len(sessions)

        for session in sessions:
            session.is_active = False
            session.revoked_at = datetime.utcnow()

        self.db.commit()

        logger.info(f"Revoked {count} sessions for user {user_id}")
        return count

    def cleanup_expired_sessions(self, days_old: int = 30) -> int:
        """
        Delete old expired sessions.

        Args:
            days_old: Delete sessions expired more than this many days ago

        Returns:
            Number of deleted sessions
        """
        cutoff = datetime.utcnow() - timedelta(days=days_old)

        result = self.db.query(UserSession).filter(
            UserSession.expires_at < cutoff,
        ).delete()

        self.db.commit()

        logger.info(f"Cleaned up {result} expired sessions")
        return result


def get_session_service(db: Session) -> SessionService:
    """Factory function for SessionService."""
    return SessionService(db)
