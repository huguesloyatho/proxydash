"""
Ping Service for uptime monitoring.
Provides ICMP ping functionality with detailed statistics (latency, jitter, packet loss).
Designed for SmokePing-style visualization.
"""

import asyncio
import subprocess
import re
import platform
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
import logging

from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from app.models.ping_history import PingHistory, PingTarget

logger = logging.getLogger(__name__)


@dataclass
class PingResult:
    """Result of a ping measurement."""
    target: str
    is_reachable: bool
    latency_min: Optional[float] = None
    latency_avg: Optional[float] = None
    latency_max: Optional[float] = None
    latency_mdev: Optional[float] = None  # Standard deviation
    jitter: Optional[float] = None
    packets_sent: int = 0
    packets_received: int = 0
    packet_loss_percent: float = 100.0
    error_message: Optional[str] = None
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()

        # Calculate jitter from mdev or min/max difference
        if self.jitter is None and self.latency_mdev is not None:
            self.jitter = self.latency_mdev
        elif self.jitter is None and self.latency_min is not None and self.latency_max is not None:
            self.jitter = (self.latency_max - self.latency_min) / 2

    def to_dict(self) -> Dict[str, Any]:
        return {
            "target": self.target,
            "is_reachable": self.is_reachable,
            "latency_min": self.latency_min,
            "latency_avg": self.latency_avg,
            "latency_max": self.latency_max,
            "latency_mdev": self.latency_mdev,
            "jitter": self.jitter,
            "packets_sent": self.packets_sent,
            "packets_received": self.packets_received,
            "packet_loss_percent": self.packet_loss_percent,
            "error_message": self.error_message,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


class PingService:
    """Service for performing ICMP ping measurements."""

    def __init__(self):
        self.system = platform.system().lower()

    async def ping(
        self,
        target: str,
        count: int = 5,
        timeout: int = 5,
    ) -> PingResult:
        """
        Ping a target and return detailed statistics.

        Args:
            target: IP address or hostname to ping
            count: Number of ping packets to send
            timeout: Timeout per ping in seconds

        Returns:
            PingResult with latency statistics
        """
        try:
            # Build ping command based on OS
            if self.system == "windows":
                cmd = ["ping", "-n", str(count), "-w", str(timeout * 1000), target]
            else:
                # Linux/macOS
                cmd = ["ping", "-c", str(count), "-W", str(timeout), target]

            # Run ping command
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout * count + 10  # Total timeout
            )

            output = stdout.decode("utf-8", errors="ignore")

            return self._parse_ping_output(target, output, count)

        except asyncio.TimeoutError:
            return PingResult(
                target=target,
                is_reachable=False,
                packets_sent=count,
                packets_received=0,
                packet_loss_percent=100.0,
                error_message="Ping timeout",
            )
        except FileNotFoundError:
            return PingResult(
                target=target,
                is_reachable=False,
                error_message="Ping command not found",
            )
        except Exception as e:
            logger.error(f"Ping error for {target}: {e}")
            return PingResult(
                target=target,
                is_reachable=False,
                error_message=str(e),
            )

    def _parse_ping_output(self, target: str, output: str, count: int) -> PingResult:
        """Parse ping command output to extract statistics."""

        result = PingResult(
            target=target,
            is_reachable=False,
            packets_sent=count,
            packets_received=0,
        )

        try:
            if self.system == "windows":
                # Windows ping output parsing
                # Packets: Sent = 5, Received = 5, Lost = 0 (0% loss)
                packet_match = re.search(
                    r"Sent\s*=\s*(\d+),\s*Received\s*=\s*(\d+)",
                    output
                )
                if packet_match:
                    result.packets_sent = int(packet_match.group(1))
                    result.packets_received = int(packet_match.group(2))

                # Minimum = 1ms, Maximum = 3ms, Average = 2ms
                stats_match = re.search(
                    r"Minimum\s*=\s*(\d+)ms,\s*Maximum\s*=\s*(\d+)ms,\s*Average\s*=\s*(\d+)ms",
                    output
                )
                if stats_match:
                    result.latency_min = float(stats_match.group(1))
                    result.latency_max = float(stats_match.group(2))
                    result.latency_avg = float(stats_match.group(3))
                    result.is_reachable = True

            else:
                # Linux/macOS ping output parsing
                # 5 packets transmitted, 5 received, 0% packet loss
                packet_match = re.search(
                    r"(\d+)\s+packets\s+transmitted,\s+(\d+)\s+(?:packets\s+)?received",
                    output
                )
                if packet_match:
                    result.packets_sent = int(packet_match.group(1))
                    result.packets_received = int(packet_match.group(2))

                # rtt min/avg/max/mdev = 0.123/0.456/0.789/0.111 ms
                stats_match = re.search(
                    r"(?:rtt|round-trip)\s+min/avg/max/(?:mdev|stddev)\s*=\s*([\d.]+)/([\d.]+)/([\d.]+)/([\d.]+)\s*ms",
                    output
                )
                if stats_match:
                    result.latency_min = float(stats_match.group(1))
                    result.latency_avg = float(stats_match.group(2))
                    result.latency_max = float(stats_match.group(3))
                    result.latency_mdev = float(stats_match.group(4))
                    result.is_reachable = True

            # Calculate packet loss
            if result.packets_sent > 0:
                result.packet_loss_percent = (
                    (result.packets_sent - result.packets_received) / result.packets_sent * 100
                )
                result.is_reachable = result.packets_received > 0

        except Exception as e:
            logger.error(f"Error parsing ping output: {e}")
            result.error_message = f"Parse error: {str(e)}"

        return result

    async def ping_multiple(
        self,
        targets: List[str],
        count: int = 5,
        timeout: int = 5,
    ) -> List[PingResult]:
        """
        Ping multiple targets concurrently.

        Args:
            targets: List of IP addresses or hostnames
            count: Number of ping packets per target
            timeout: Timeout per ping in seconds

        Returns:
            List of PingResult objects
        """
        tasks = [
            self.ping(target, count, timeout)
            for target in targets
        ]
        return await asyncio.gather(*tasks)


# Database operations
class PingHistoryService:
    """Service for managing ping history in database."""

    def __init__(self, db: Session):
        self.db = db
        self.ping_service = PingService()

    async def perform_and_record_ping(
        self,
        target: str,
        target_name: Optional[str] = None,
        widget_id: Optional[int] = None,
        count: int = 5,
        timeout: int = 5,
    ) -> PingResult:
        """
        Perform a ping and record the result in the database.

        Args:
            target: IP address or hostname
            target_name: Friendly name for the target
            widget_id: Associated widget ID
            count: Number of pings
            timeout: Timeout per ping

        Returns:
            PingResult with measurement data
        """
        result = await self.ping_service.ping(target, count, timeout)

        # Save to database
        history = PingHistory(
            target=target,
            target_name=target_name,
            widget_id=widget_id,
            timestamp=result.timestamp,
            latency_min=result.latency_min,
            latency_avg=result.latency_avg,
            latency_max=result.latency_max,
            latency_mdev=result.latency_mdev,
            jitter=result.jitter,
            packets_sent=result.packets_sent,
            packets_received=result.packets_received,
            packet_loss_percent=result.packet_loss_percent,
            is_reachable=result.is_reachable,
            error_message=result.error_message,
        )
        self.db.add(history)
        self.db.commit()

        return result

    def get_history(
        self,
        target: str,
        hours: int = 24,
        widget_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get ping history for a target.

        Args:
            target: IP address or hostname
            hours: Number of hours of history to retrieve
            widget_id: Filter by widget ID

        Returns:
            List of ping history records
        """
        cutoff = datetime.utcnow() - timedelta(hours=hours)

        query = self.db.query(PingHistory).filter(
            PingHistory.target == target,
            PingHistory.timestamp >= cutoff,
        )

        if widget_id:
            query = query.filter(PingHistory.widget_id == widget_id)

        records = query.order_by(PingHistory.timestamp.asc()).all()

        return [
            {
                "timestamp": r.timestamp.isoformat(),
                "latency_min": r.latency_min,
                "latency_avg": r.latency_avg,
                "latency_max": r.latency_max,
                "jitter": r.jitter,
                "packet_loss_percent": r.packet_loss_percent,
                "is_reachable": r.is_reachable,
            }
            for r in records
        ]

    def get_statistics(
        self,
        target: str,
        hours: int = 24,
        widget_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Get aggregated statistics for a target.

        Args:
            target: IP address or hostname
            hours: Number of hours to aggregate
            widget_id: Filter by widget ID

        Returns:
            Dictionary with aggregated statistics
        """
        cutoff = datetime.utcnow() - timedelta(hours=hours)

        query = self.db.query(
            func.count(PingHistory.id).label("total_measurements"),
            func.avg(PingHistory.latency_avg).label("avg_latency"),
            func.min(PingHistory.latency_min).label("min_latency"),
            func.max(PingHistory.latency_max).label("max_latency"),
            func.avg(PingHistory.jitter).label("avg_jitter"),
            func.avg(PingHistory.packet_loss_percent).label("avg_packet_loss"),
            func.sum(
                func.cast(PingHistory.is_reachable == False, Integer)
            ).label("outages"),
        ).filter(
            PingHistory.target == target,
            PingHistory.timestamp >= cutoff,
        )

        if widget_id:
            query = query.filter(PingHistory.widget_id == widget_id)

        result = query.first()

        if not result or result.total_measurements == 0:
            return {
                "total_measurements": 0,
                "avg_latency": None,
                "min_latency": None,
                "max_latency": None,
                "avg_jitter": None,
                "avg_packet_loss": 0,
                "uptime_percent": 0,
                "outages": 0,
            }

        uptime = (
            (result.total_measurements - (result.outages or 0))
            / result.total_measurements * 100
        ) if result.total_measurements > 0 else 0

        return {
            "total_measurements": result.total_measurements,
            "avg_latency": round(result.avg_latency, 2) if result.avg_latency else None,
            "min_latency": round(result.min_latency, 2) if result.min_latency else None,
            "max_latency": round(result.max_latency, 2) if result.max_latency else None,
            "avg_jitter": round(result.avg_jitter, 2) if result.avg_jitter else None,
            "avg_packet_loss": round(result.avg_packet_loss, 2) if result.avg_packet_loss else 0,
            "uptime_percent": round(uptime, 2),
            "outages": result.outages or 0,
        }

    def cleanup_old_history(self, days: int = 30) -> int:
        """
        Delete ping history older than specified days.

        Args:
            days: Number of days to keep

        Returns:
            Number of deleted records
        """
        cutoff = datetime.utcnow() - timedelta(days=days)

        deleted = self.db.query(PingHistory).filter(
            PingHistory.timestamp < cutoff
        ).delete()

        self.db.commit()
        return deleted


# Add Integer import for the sum/cast query
from sqlalchemy import Integer
