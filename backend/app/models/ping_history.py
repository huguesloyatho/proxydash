"""
Ping History model for storing uptime monitoring data.
Stores individual ping measurements with detailed metrics (latency, jitter, packet loss).
Used by the Uptime/Ping widget for SmokePing-style visualization.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Index
from sqlalchemy.sql import func

from app.core.database import Base


class PingHistory(Base):
    """
    Stores ping measurement history for uptime monitoring.
    Each record represents a single ping measurement batch (multiple pings to one target).
    """
    __tablename__ = "ping_history"

    id = Column(Integer, primary_key=True, index=True)

    # Target identification
    target = Column(String(255), nullable=False, index=True)  # IP or hostname
    target_name = Column(String(100), nullable=True)  # Friendly name
    widget_id = Column(Integer, nullable=True, index=True)  # Associated widget (optional)

    # Timestamp of measurement
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Latency metrics (in milliseconds)
    latency_min = Column(Float, nullable=True)   # Minimum RTT
    latency_avg = Column(Float, nullable=True)   # Average RTT
    latency_max = Column(Float, nullable=True)   # Maximum RTT
    latency_mdev = Column(Float, nullable=True)  # Standard deviation (for jitter calculation)

    # Jitter (variation in latency) - calculated as mdev or difference between max/min
    jitter = Column(Float, nullable=True)

    # Packet loss statistics
    packets_sent = Column(Integer, default=5)
    packets_received = Column(Integer, default=5)
    packet_loss_percent = Column(Float, default=0.0)  # 0-100%

    # Status
    is_reachable = Column(Boolean, default=True)
    error_message = Column(String(500), nullable=True)  # If ping failed

    # Indexes for efficient querying
    __table_args__ = (
        Index('ix_ping_history_target_timestamp', 'target', 'timestamp'),
        Index('ix_ping_history_widget_timestamp', 'widget_id', 'timestamp'),
    )


class PingTarget(Base):
    """
    Stores ping target configurations.
    Allows managing multiple targets independently of widgets.
    """
    __tablename__ = "ping_targets"

    id = Column(Integer, primary_key=True, index=True)

    # Target details
    target = Column(String(255), nullable=False, unique=True)  # IP or hostname
    name = Column(String(100), nullable=True)  # Friendly name
    description = Column(String(500), nullable=True)

    # Ping configuration
    ping_interval = Column(Integer, default=60)  # Seconds between pings
    ping_count = Column(Integer, default=5)  # Number of pings per measurement
    ping_timeout = Column(Integer, default=5)  # Timeout in seconds

    # Status
    is_enabled = Column(Boolean, default=True)
    last_check = Column(DateTime(timezone=True), nullable=True)
    last_status = Column(Boolean, nullable=True)  # Last known reachability

    # Alerting (optional)
    alert_on_down = Column(Boolean, default=False)
    alert_threshold = Column(Integer, default=3)  # Number of failures before alert
    consecutive_failures = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
