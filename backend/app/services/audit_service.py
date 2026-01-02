"""
Audit Service for logging user actions.
"""

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session
from fastapi import Request

from app.models.audit_log import AuditLog, AuditAction

logger = logging.getLogger(__name__)


class AuditService:
    """Service for creating audit log entries."""

    def __init__(self, db: Session):
        self.db = db

    def log(
        self,
        action: AuditAction,
        user_id: Optional[int] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        resource_name: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuditLog:
        """
        Create an audit log entry.

        Args:
            action: The action being logged
            user_id: ID of the user performing the action
            resource_type: Type of resource affected (user, server, etc.)
            resource_id: ID of the affected resource
            resource_name: Name of the affected resource
            details: Additional context as JSON
            ip_address: Client IP address
            user_agent: Client user agent string

        Returns:
            Created AuditLog entry
        """
        log_entry = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        self.db.add(log_entry)
        self.db.commit()
        self.db.refresh(log_entry)

        logger.info(
            f"Audit: {action.value} by user {user_id} "
            f"on {resource_type}:{resource_id} ({resource_name})"
        )

        return log_entry

    def log_from_request(
        self,
        request: Request,
        action: AuditAction,
        user_id: Optional[int] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        resource_name: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        """
        Create an audit log entry with request context.

        Automatically extracts IP and user agent from request.
        """
        # Get client IP (handle proxies)
        ip_address = request.headers.get("X-Forwarded-For")
        if ip_address:
            ip_address = ip_address.split(",")[0].strip()
        else:
            ip_address = request.client.host if request.client else None

        user_agent = request.headers.get("User-Agent")

        return self.log(
            action=action,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
        )


def get_audit_service(db: Session) -> AuditService:
    """Factory function for AuditService."""
    return AuditService(db)
