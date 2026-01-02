"""
Command Executor Service for App Dashboards.
Executes commands on remote servers via SSH with variable substitution and output parsing.
"""

import asyncio
import asyncssh
import json
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from sqlalchemy.orm import Session

from app.models.server import Server

logger = logging.getLogger(__name__)


@dataclass
class CommandResult:
    """Result of a command execution."""
    success: bool
    output: Any  # Parsed output (can be dict, list, str, int, etc.)
    raw_output: str  # Raw stdout
    error: Optional[str] = None
    exit_code: int = 0
    execution_time: float = 0.0


class CommandExecutor:
    """
    Executes commands on remote servers with variable substitution.
    Supports multiple output parsers: json, number, lines, table.
    """

    # Allowed command prefixes for security
    ALLOWED_PREFIXES = [
        "docker exec",
        "docker logs",
        "docker stats",
        "docker ps",
        "docker inspect",
        "cat /",
        "tail ",
        "head ",
        "grep ",
        "wc ",
        "df ",
        "free ",
        "uptime",
        "systemctl status",
        "journalctl",
        "curl ",  # For API calls (Headscale, etc.)
    ]

    def __init__(
        self,
        host: str,
        ssh_port: int = 22,
        ssh_user: str = "root",
        ssh_key: str = "",
        ssh_password: str = "",
    ):
        self.host = host
        self.ssh_port = ssh_port
        self.ssh_user = ssh_user
        self.ssh_key = ssh_key
        self.ssh_password = ssh_password
        self._connection: Optional[asyncssh.SSHClientConnection] = None

    @classmethod
    async def from_server(cls, db: Session, server_id: int) -> Optional["CommandExecutor"]:
        """Create executor from a Server model."""
        server = db.query(Server).filter(Server.id == server_id).first()
        if not server:
            return None

        return cls(
            host=server.host,
            ssh_port=server.ssh_port,
            ssh_user=server.ssh_user,
            ssh_key=server.ssh_key or "",
            ssh_password=server.ssh_password or "",
        )

    async def _get_connection(self) -> asyncssh.SSHClientConnection:
        """Get or create SSH connection."""
        if self._connection is not None:
            return self._connection

        connect_opts = {
            "host": self.host,
            "port": self.ssh_port,
            "username": self.ssh_user,
            "known_hosts": None,
        }

        if self.ssh_key:
            key_content = self.ssh_key
            if self.ssh_key.startswith("~") or self.ssh_key.startswith("/"):
                key_path = os.path.expanduser(self.ssh_key)
                if os.path.exists(key_path):
                    with open(key_path, "r") as f:
                        key_content = f.read()
                else:
                    raise ValueError(f"SSH key file not found: {key_path}")
            key = asyncssh.import_private_key(key_content)
            connect_opts["client_keys"] = [key]
        elif self.ssh_password:
            connect_opts["password"] = self.ssh_password
        else:
            raise ValueError("Neither SSH key nor password provided")

        self._connection = await asyncssh.connect(**connect_opts)
        return self._connection

    async def close(self):
        """Close SSH connection."""
        if self._connection:
            self._connection.close()
            await self._connection.wait_closed()
            self._connection = None

    def substitute_variables(
        self, command: str, variables: Dict[str, Any], row: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Substitute variables in command template.

        Supports:
        - {{variable_name}} - from variables dict
        - {{row.field}} - from row data (for row actions)
        - {{input.field}} - from user input (for action buttons)
        """
        result = command

        # Substitute regular variables
        for key, value in variables.items():
            placeholder = f"{{{{{key}}}}}"
            result = result.replace(placeholder, self._escape_shell_arg(str(value)))

        # Substitute row variables
        if row:
            for key, value in row.items():
                placeholder = f"{{{{row.{key}}}}}"
                result = result.replace(placeholder, self._escape_shell_arg(str(value)))

        return result

    def _escape_shell_arg(self, arg: str) -> str:
        """Escape shell argument to prevent injection."""
        # Remove dangerous shell metacharacters that could lead to command injection
        # Note: We preserve {, }, [, ] as they're needed for JSON payloads in curl commands
        dangerous_chars = [";", "&", "|", "`", "$", "(", ")", "<", ">", "\n", "\r"]
        for char in dangerous_chars:
            arg = arg.replace(char, "")
        return arg

    def validate_command(self, command: str) -> bool:
        """
        Validate that command is allowed.
        Returns True if command starts with an allowed prefix.
        """
        command_lower = command.strip().lower()
        for prefix in self.ALLOWED_PREFIXES:
            if command_lower.startswith(prefix.lower()):
                return True
        return False

    async def execute(
        self,
        command: str,
        variables: Optional[Dict[str, Any]] = None,
        row: Optional[Dict[str, Any]] = None,
        parser: str = "raw",
        timeout: float = 30.0,
        validate: bool = True,
    ) -> CommandResult:
        """
        Execute a command with variable substitution and output parsing.

        Args:
            command: Command template with {{variable}} placeholders
            variables: Variables to substitute
            row: Row data for row actions
            parser: Output parser: 'raw', 'json', 'number', 'lines', 'table'
            timeout: Command timeout in seconds
            validate: Whether to validate command against whitelist

        Returns:
            CommandResult with parsed output
        """
        start_time = datetime.now()
        variables = variables or {}

        # Substitute variables
        final_command = self.substitute_variables(command, variables, row)

        # Debug: log the final command
        logger.info(f"Executing command on {self.host}: {final_command[:200]}...")

        # Validate command
        if validate and not self.validate_command(final_command):
            return CommandResult(
                success=False,
                output=None,
                raw_output="",
                error=f"Command not allowed: {final_command[:50]}...",
                exit_code=-1,
            )

        try:
            conn = await self._get_connection()

            # Execute with timeout
            result = await asyncio.wait_for(
                conn.run(final_command, check=False),
                timeout=timeout,
            )

            execution_time = (datetime.now() - start_time).total_seconds()
            raw_output = result.stdout or ""
            error_output = result.stderr or ""

            if result.exit_status != 0:
                return CommandResult(
                    success=False,
                    output=None,
                    raw_output=raw_output,
                    error=error_output or f"Command exited with code {result.exit_status}",
                    exit_code=result.exit_status,
                    execution_time=execution_time,
                )

            # Parse output
            parsed_output = self.parse_output(raw_output.strip(), parser)

            return CommandResult(
                success=True,
                output=parsed_output,
                raw_output=raw_output,
                exit_code=0,
                execution_time=execution_time,
            )

        except asyncio.TimeoutError:
            return CommandResult(
                success=False,
                output=None,
                raw_output="",
                error=f"Command timed out after {timeout}s",
                exit_code=-1,
            )
        except asyncssh.Error as e:
            logger.error(f"SSH error executing command on {self.host}: {e}")
            return CommandResult(
                success=False,
                output=None,
                raw_output="",
                error=f"SSH error: {str(e)}",
                exit_code=-1,
            )
        except Exception as e:
            logger.error(f"Error executing command on {self.host}: {e}")
            return CommandResult(
                success=False,
                output=None,
                raw_output="",
                error=str(e),
                exit_code=-1,
            )

    def parse_output(self, output: str, parser: str) -> Any:
        """
        Parse command output based on parser type.

        Parsers:
        - raw: Return output as-is
        - json: Parse as JSON
        - number: Extract first number
        - lines: Split into lines array
        - table: Parse space/tab separated table
        """
        if not output:
            if parser == "json":
                return []
            elif parser == "number":
                return 0
            elif parser == "lines":
                return []
            return ""

        if parser == "raw":
            return output

        elif parser == "json":
            try:
                parsed = json.loads(output)
                # Debug: log first item structure
                if isinstance(parsed, list) and len(parsed) > 0:
                    print(f"[DEBUG JSON] First item keys: {list(parsed[0].keys()) if isinstance(parsed[0], dict) else 'not a dict'}")
                    print(f"[DEBUG JSON] First item: {json.dumps(parsed[0], indent=2)[:800]}")
                return parsed
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse JSON output: {output[:100]}")
                return []

        elif parser == "number":
            # Extract first number from output
            match = re.search(r"[-+]?\d*\.?\d+", output)
            if match:
                num_str = match.group()
                try:
                    if "." in num_str:
                        return float(num_str)
                    return int(num_str)
                except ValueError:
                    return 0
            return 0

        elif parser == "lines":
            return [line for line in output.split("\n") if line.strip()]

        elif parser == "table":
            # Parse table output (header + rows)
            lines = [line for line in output.split("\n") if line.strip()]
            if len(lines) < 2:
                return {"headers": [], "rows": []}

            # First line is headers
            headers = lines[0].split()
            rows = []
            for line in lines[1:]:
                values = line.split()
                if values:
                    row = {}
                    for i, header in enumerate(headers):
                        row[header] = values[i] if i < len(values) else ""
                    rows.append(row)

            return {"headers": headers, "rows": rows}

        return output


async def execute_dashboard_command(
    db: Session,
    server_id: int,
    command: str,
    variables: Dict[str, Any],
    parser: str = "raw",
    row: Optional[Dict[str, Any]] = None,
) -> CommandResult:
    """
    Helper function to execute a dashboard command.

    Args:
        db: Database session
        server_id: Server ID for SSH connection
        command: Command template
        variables: Variables for substitution
        parser: Output parser type
        row: Row data for row actions

    Returns:
        CommandResult
    """
    executor = await CommandExecutor.from_server(db, server_id)
    if not executor:
        return CommandResult(
            success=False,
            output=None,
            raw_output="",
            error=f"Server {server_id} not found",
            exit_code=-1,
        )

    try:
        return await executor.execute(command, variables, row, parser)
    finally:
        await executor.close()
