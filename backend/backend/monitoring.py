# monitoring.py — Platform monitoring endpoint
# Import this in main.py and add the endpoint

import time
import platform
import shutil
import os
import requests as http_requests
from datetime import datetime

# Track server start time
SERVER_START_TIME = time.time()


def get_monitoring_data(scans_db: dict, ws_clients: dict) -> dict:
    """Collect all monitoring metrics."""

    now = time.time()
    uptime_seconds = int(now - SERVER_START_TIME)
    uptime_str = _format_uptime(uptime_seconds)

    # ── Backend status ──────────────────────────────────────────
    backend = {
        "status": "up",
        "uptime": uptime_str,
        "uptime_seconds": uptime_seconds,
        "started_at": datetime.fromtimestamp(SERVER_START_TIME).isoformat(),
        "python_version": platform.python_version(),
        "os": f"{platform.system()} {platform.release()}",
        "architecture": platform.machine(),
    }

    # ── System info ─────────────────────────────────────────────
    disk = shutil.disk_usage("/")
    system = {
        "hostname": platform.node(),
        "os_full": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "python": platform.python_version(),
        "cpu_count": os.cpu_count(),
        "disk_total_gb": round(disk.total / (1024**3), 1),
        "disk_used_gb": round(disk.used / (1024**3), 1),
        "disk_free_gb": round(disk.free / (1024**3), 1),
        "disk_percent": round(disk.used / disk.total * 100, 1),
    }

    # ── Ollama LLM status ───────────────────────────────────────
    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
    ollama = _check_ollama(ollama_url)

    # ── Docker status ───────────────────────────────────────────
    docker = _check_docker()

    # ── Scan statistics ─────────────────────────────────────────
    all_scans = list(scans_db.values())
    running_scans = [s for s in all_scans if s.get("status") == "running"]
    finished_scans = [s for s in all_scans if s.get("status") == "finished"]
    error_scans = [s for s in all_scans if s.get("status") == "error"]

    # Agent distribution
    web_count = len([s for s in all_scans if s.get("agent_type") in ("web", "unknown")])
    ad_count = len([s for s in all_scans if s.get("agent_type") == "ad"])

    # Last 5 scans with duration
    recent_scans = sorted(all_scans, key=lambda s: s.get("started_at", ""), reverse=True)[:5]
    scan_trends = []
    for s in recent_scans:
        duration = 0
        if s.get("finished_at") and s.get("started_at"):
            try:
                start = datetime.fromisoformat(s["started_at"])
                end = datetime.fromisoformat(s["finished_at"])
                duration = int((end - start).total_seconds())
            except:
                pass
        scan_trends.append({
            "scan_id": s.get("scan_id", "")[:8],
            "target": s.get("target", "")[:30],
            "status": s.get("status", ""),
            "agent_type": s.get("agent_type", "unknown"),
            "duration_seconds": duration,
            "vulns": len(s.get("vulnerabilities", [])),
            "cvss_max": s.get("cvss_max", 0),
            "started_at": s.get("started_at", ""),
        })

    # Live running scans feed
    live_scans = []
    for s in running_scans:
        steps = s.get("steps", [])
        last_step = steps[-1] if steps else None
        live_scans.append({
            "scan_id": s.get("scan_id", "")[:8],
            "target": s.get("target", ""),
            "agent_type": s.get("agent_type", "unknown"),
            "current_step": len(steps),
            "max_steps": s.get("max_steps", 8),
            "last_tool": last_step["tool"] if last_step else "initializing",
            "started_at": s.get("started_at", ""),
        })

    scans_stats = {
        "total": len(all_scans),
        "running": len(running_scans),
        "finished": len(finished_scans),
        "error": len(error_scans),
        "agent_distribution": {
            "web": web_count,
            "ad": ad_count,
        },
        "trends": scan_trends,
        "live": live_scans,
    }

    # ── WebSocket connections ───────────────────────────────────
    ws_count = sum(len(clients) for clients in ws_clients.values())

    return {
        "timestamp": datetime.now().isoformat(),
        "backend": backend,
        "system": system,
        "ollama": ollama,
        "docker": docker,
        "scans": scans_stats,
        "websocket_connections": ws_count,
    }


def _check_ollama(base_url: str) -> dict:
    """Check Ollama connectivity and list available models."""
    try:
        start = time.time()
        r = http_requests.get(f"{base_url.rstrip('/')}/api/tags", timeout=5)
        latency = int((time.time() - start) * 1000)

        if r.status_code == 200:
            data = r.json()
            models = []
            for m in data.get("models", []):
                models.append({
                    "name": m.get("name", ""),
                    "size_gb": round(m.get("size", 0) / (1024**3), 1),
                    "modified": m.get("modified_at", "")[:19],
                })
            return {
                "status": "connected",
                "url": base_url,
                "latency_ms": latency,
                "models": models,
                "model_count": len(models),
            }
        return {"status": "error", "url": base_url, "latency_ms": latency, "models": [], "model_count": 0}
    except http_requests.exceptions.ConnectionError:
        return {"status": "disconnected", "url": base_url, "latency_ms": 0, "models": [], "model_count": 0}
    except Exception as e:
        return {"status": "error", "url": base_url, "latency_ms": 0, "models": [], "model_count": 0, "error": str(e)[:100]}


def _check_docker() -> dict:
    """Check Docker availability."""
    import subprocess
    try:
        r = subprocess.run(["docker", "info"], capture_output=True, text=True, timeout=5)
        if r.returncode == 0:
            # Count running containers
            r2 = subprocess.run(["docker", "ps", "-q"], capture_output=True, text=True, timeout=5)
            containers = len(r2.stdout.strip().split("\n")) if r2.stdout.strip() else 0

            # Get docker version
            r3 = subprocess.run(["docker", "--version"], capture_output=True, text=True, timeout=3)
            version = r3.stdout.strip() if r3.stdout else "unknown"

            return {
                "status": "running",
                "version": version,
                "running_containers": containers,
            }
        return {"status": "error", "version": "", "running_containers": 0}
    except FileNotFoundError:
        return {"status": "not_installed", "version": "", "running_containers": 0}
    except subprocess.TimeoutExpired:
        return {"status": "timeout", "version": "", "running_containers": 0}
    except Exception as e:
        return {"status": "error", "version": "", "running_containers": 0, "error": str(e)[:100]}


def _format_uptime(seconds: int) -> str:
    days = seconds // 86400
    hours = (seconds % 86400) // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    parts = []
    if days > 0: parts.append(f"{days}d")
    if hours > 0: parts.append(f"{hours}h")
    if minutes > 0: parts.append(f"{minutes}m")
    parts.append(f"{secs}s")
    return " ".join(parts)