# core/executor.py — Tool executor
# Handles three execution modes:
#   1. python-scan  → native Python scanner (no subprocess)
#   2. wsl / AD tools → runs through WSL2 (enum4linux, smbclient, rpcclient, nmap)
#   3. docker run  → Docker containers (nmap, nikto, curl)

import subprocess
import shlex


# AD tools that must run through WSL2
WSL_TOOLS = ("enum4linux", "smbclient", "rpcclient", "nmblookup", "ldapsearch", "net ")


def run_tool(command: str, timeout: int = 180) -> str:
    """Execute a tool command and return its output as a string."""
    if not command.strip():
        return "ERROR: empty command"

    cmd = command.strip()

    # ── 1. python-scan — native, no subprocess ─────────────────────
    if cmd.startswith("python-scan"):
        parts = cmd.split()
        target = parts[1] if len(parts) > 1 else ""
        if not target:
            return "ERROR: python-scan requires a target URL"
        try:
            from core.scanner import scan_target
            result = scan_target(target)
            return result["output"] if result["output"] else "No output from scanner"
        except Exception as e:
            return f"ERROR in python-scan: {str(e)}"

    # ── 2. AD tools → route through WSL2 ───────────────────────────
    if any(tool in cmd for tool in WSL_TOOLS):
        return _run_wsl(cmd, timeout)

    # ── 3. Everything else → Docker ────────────────────────────────
    return _run_docker(cmd, timeout)


def _run_wsl(command: str, timeout: int) -> str:
    """Run an AD/SMB tool natively (when backend runs inside WSL2/Linux)."""
    try:
        result = subprocess.run(
            ["bash", "-c", command],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output = result.stdout or result.stderr
        return output.strip() if output.strip() else "No output returned."
    except subprocess.TimeoutExpired:
        return "TIMEOUT: command took too long"
    except FileNotFoundError:
        return "ERROR: bash not found"
    except Exception as e:
        return f"ERROR in execution: {str(e)}"


def _run_docker(command: str, timeout: int) -> str:
    """Run a Docker command."""
    try:
        args = shlex.split(command)
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output = result.stdout or result.stderr
        return output.strip() if output.strip() else "No output returned."
    except subprocess.TimeoutExpired:
        return "TIMEOUT: tool took too long"
    except FileNotFoundError as e:
        return f"TOOL_NOT_FOUND: {str(e)}"
    except Exception as e:
        return f"ERROR: {str(e)}"