# core/executor.py — Tool executor
# Handles execution modes:
#   1. python-scan  → native Python scanner (no subprocess)
#   2. AD tools     → runs natively via bash (enum4linux, smbclient, rpcclient, etc.)
#   3. docker run   → Docker containers (nmap, nikto, gobuster, ffuf, sslscan, nuclei, curl)
#   4. native tools → tools installed locally (rustscan, nmap, curl, gobuster)

import subprocess
import shlex


# AD tools that run natively via bash
AD_TOOLS = ("enum4linux", "smbclient", "rpcclient", "nmblookup", "ldapsearch", "net ")

# Tools that run natively (installed in WSL2) — no Docker needed
NATIVE_TOOLS = ("nmap", "rustscan", "curl", "gobuster", "ffuf", "sslscan", "dig", "whois")


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

    # ── 2. AD tools → native bash execution ────────────────────────
    if any(tool in cmd for tool in AD_TOOLS):
        return _run_native(cmd, timeout)

    # ── 3. Check if it's a native tool (installed in WSL2/Linux) ───
    tool_name = cmd.split()[0] if not cmd.startswith("docker") else ""
    if tool_name and any(cmd.startswith(t) for t in NATIVE_TOOLS):
        return _run_native(cmd, timeout)

    # ── 4. Everything else → try Docker, fallback to native ────────
    if cmd.startswith("docker"):
        return _run_native(cmd, timeout)

    # Default: try native execution
    return _run_native(cmd, timeout)


def _run_native(command: str, timeout: int) -> str:
    """Run a command natively via bash."""
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