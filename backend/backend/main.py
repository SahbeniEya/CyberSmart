# main.py — FastAPI backend
from github_actions import get_workflow_runs, get_run_jobs, get_run_logs, trigger_workflow

import uuid
import asyncio
from datetime import datetime, timedelta
from threading import Thread
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt

from core.graph import run_pentest
from core.state import PentestState

from database import (
    db_create_scan, db_update_scan, db_get_scan, db_list_scans,
    db_set_github_link, db_get_github_link,
    db_create_user, db_get_user, db_list_users, db_update_user, db_delete_user,
    verify_password,
)

# ── App setup ──────────────────────────────────────────────────────────────
app = FastAPI(title="CyberSmart — Autonomous Security Platform", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "pentest-ai-secret-2025"
ALGORITHM  = "HS256"
security   = HTTPBearer()

# ── In-memory scan store ──────────────────────────────────────────────────
scans_db: dict[str, dict] = {}
ws_clients: dict[str, list] = {}


# ── Auth helpers ───────────────────────────────────────────────────────────

def create_token(username: str, role: str) -> str:
    payload = {
        "sub":  username,
        "role": role,
        "exp":  datetime.utcnow() + timedelta(hours=24),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return {"username": payload["sub"], "role": payload["role"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_admin(user=Depends(get_current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_devops_or_admin(user=Depends(get_current_user)) -> dict:
    if user["role"] not in ("admin", "devops"):
        raise HTTPException(status_code=403, detail="DevOps or Admin access required")
    return user


# ── Auth endpoints ─────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    email:    str
    password: str

class LoginResponse(BaseModel):
    token:    str
    username: str
    role:     str

# ── Add this to main.py, after the /auth/me endpoint ──

class ProfileUpdateRequest(BaseModel):
    email:            Optional[str] = None
    current_password: Optional[str] = None
    new_password:     Optional[str] = None

@app.put("/auth/profile")
def update_profile(req: ProfileUpdateRequest, user=Depends(get_current_user)):
    updates = {}

    if req.email:
        if "@" not in req.email:
            raise HTTPException(status_code=400, detail="Invalid email address")
        updates["email"] = req.email

    if req.new_password:
        if not req.current_password:
            raise HTTPException(status_code=400, detail="Current password required")
        db_user = db_get_user(user["username"])
        if not db_user or not verify_password(req.current_password, db_user["password"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        if len(req.new_password) < 6:
            raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
        updates["password"] = req.new_password

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = db_update_user(user["username"], updates)
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    return result

@app.post("/auth/login", response_model=LoginResponse)
def login(req: LoginRequest):
    user = db_get_user(req.username)
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(req.username, user["role"])
    return LoginResponse(token=token, username=req.username, role=user["role"])


@app.post("/auth/register")
def register(req: RegisterRequest):
    if len(req.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if "@" not in req.email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    result = db_create_user(req.username, req.email, req.password, role="pentester")
    if not result:
        raise HTTPException(status_code=409, detail="Username or email already taken")

    token = create_token(req.username, "pentester")
    return {"token": token, "username": req.username, "role": "pentester"}


# ── Admin: User management (CRUD) ─────────────────────────────────────────

class CreateUserRequest(BaseModel):
    username: str
    email:    str
    password: str
    role:     str = "pentester"  # admin | pentester | devops

class UpdateUserRequest(BaseModel):
    email:    Optional[str] = None
    role:     Optional[str] = None
    password: Optional[str] = None


@app.get("/admin/users")
def admin_list_users(user=Depends(require_admin)):
    return db_list_users()


@app.post("/admin/users")
def admin_create_user(req: CreateUserRequest, user=Depends(require_admin)):
    if req.role not in ("admin", "pentester", "devops"):
        raise HTTPException(status_code=400, detail="Role must be admin, pentester, or devops")
    result = db_create_user(req.username, req.email, req.password, role=req.role)
    if not result:
        raise HTTPException(status_code=409, detail="Username or email already taken")
    return result


@app.put("/admin/users/{username}")
def admin_update_user(username: str, req: UpdateUserRequest, user=Depends(require_admin)):
    updates = {}
    if req.email is not None:
        updates["email"] = req.email
    if req.role is not None:
        if req.role not in ("admin", "pentester", "devops"):
            raise HTTPException(status_code=400, detail="Role must be admin, pentester, or devops")
        updates["role"] = req.role
    if req.password is not None:
        updates["password"] = req.password
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = db_update_user(username, updates)
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    return result


@app.delete("/admin/users/{username}")
def admin_delete_user(username: str, user=Depends(require_admin)):
    if username == user["username"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    if not db_delete_user(username):
        raise HTTPException(status_code=404, detail="User not found")
    return {"deleted": username}


# ── Scans ──────────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    target:      str
    model:       str = "llama3.1:latest"
    max_steps:   int = 8
    agent_type:  str = "unknown"

class ScanResponse(BaseModel):
    scan_id:    str
    target:     str
    status:     str
    started_at: str


def run_scan_background(scan_id: str, target: str, model: str, max_steps: int,
                          agent_type: str = "unknown"):
    def scan_runner():
        try:
            final_state = run_pentest(scan_id, target, model, max_steps,
                                       agent_type=agent_type)
            updates = {
                "status":                final_state.get("status", "finished"),
                "agent_type":            final_state.get("agent_type"),
                "orchestrator_decisions": final_state.get("orchestrator_decisions", []),
                "open_ports":            final_state.get("open_ports", []),
                "services":              final_state.get("services", []),
                "vulnerabilities":       final_state.get("vulnerabilities", []),
                "cvss_max":              final_state.get("cvss_max", 0.0),
                "steps":                 final_state.get("steps", []),
                "finished_at":           final_state.get("finished_at"),
            }
            scans_db[scan_id].update(updates)
            db_update_scan(scan_id, updates)
        except Exception as e:
            import traceback
            print(f"   ❌ Scan error: {e}")
            traceback.print_exc()
            scans_db[scan_id]["status"] = "error"
            scans_db[scan_id]["error"]  = str(e)
            db_update_scan(scan_id, {"status": "error", "error": str(e)})

    Thread(target=scan_runner, daemon=True).start()


@app.post("/scans", response_model=ScanResponse)
def create_scan(req: ScanRequest, user=Depends(get_current_user)):
    # Pentesters and admins can create scans; devops cannot
    if user["role"] == "devops":
        raise HTTPException(status_code=403, detail="DevOps users cannot launch scans. Use the CI/CD pipeline.")
    scan_id = str(uuid.uuid4())[:8]
    scan = {
        "scan_id":    scan_id,
        "target":     req.target,
        "model":      req.model,
        "agent_type": req.agent_type,
        "status":     "running",
        "started_at": datetime.now().isoformat(),
        "started_by": user["username"],
        "steps":      [],
        "orchestrator_decisions": [],
        "open_ports": [],
        "services":   [],
        "vulnerabilities": [],
        "cvss_max":   0.0,
        "finished_at": None,
        "error":       None,
    }
    scans_db[scan_id] = scan
    db_create_scan(scan)
    run_scan_background(scan_id, req.target, req.model, req.max_steps,
                         agent_type=req.agent_type)
    return ScanResponse(**{k: scan[k] for k in ScanResponse.model_fields})


@app.get("/scans")
def list_scans(user=Depends(get_current_user)):
    return list(scans_db.values())


@app.get("/scans/{scan_id}")
def get_scan(scan_id: str, user=Depends(get_current_user)):
    scan = scans_db.get(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


# ── WebSocket — live updates ───────────────────────────────────────────────

@app.websocket("/ws/{scan_id}")
async def websocket_endpoint(websocket: WebSocket, scan_id: str):
    await websocket.accept()
    if scan_id not in ws_clients:
        ws_clients[scan_id] = []
    ws_clients[scan_id].append(websocket)

    try:
        last_step_count = 0
        while True:
            await asyncio.sleep(1)
            scan = scans_db.get(scan_id)
            if not scan:
                break

            steps = scan.get("steps", [])
            if len(steps) > last_step_count:
                for step in steps[last_step_count:]:
                    await websocket.send_json({"type": "step", "data": step})
                last_step_count = len(steps)

            await websocket.send_json({"type": "status", "data": scan["status"]})

            if scan["status"] in ("finished", "error"):
                await websocket.send_json({"type": "done", "data": scan})
                break

    except WebSocketDisconnect:
        ws_clients[scan_id].remove(websocket)


# ── GitHub repo link (DevOps + Admin only) ────────────────────────────────

class GithubLinkRequest(BaseModel):
    repo_url: str

@app.post("/github/link")
def set_github_link(req: GithubLinkRequest, user=Depends(require_devops_or_admin)):
    db_set_github_link(user["username"], req.repo_url)
    return {"username": user["username"], "repo_url": req.repo_url}

@app.get("/github/link")
def get_github_link(user=Depends(get_current_user)):
    repo_url = db_get_github_link(user["username"])
    return {"repo_url": repo_url}


# ── Current user profile ──────────────────────────────────────────────────

@app.get("/auth/me")
def get_me(user=Depends(get_current_user)):
    db_user = db_get_user(user["username"])
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"username": db_user["username"], "email": db_user["email"], "role": db_user["role"]}


# ── Health check ───────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}


# ── GitHub Token storage ──────────────────────────────────────────────────
# For simplicity, store tokens alongside the github_links.
# Add to database.py's GithubLink model:
#   token = Column(String(500), nullable=True)

class GithubTokenRequest(BaseModel):
    token: str

@app.post("/github/token")
def set_github_token(req: GithubTokenRequest, user=Depends(require_devops_or_admin)):
    """Store GitHub Personal Access Token for API access."""
    from database import db_set_github_token
    db_set_github_token(user["username"], req.token)
    return {"status": "saved"}

@app.get("/github/token")
def get_github_token(user=Depends(require_devops_or_admin)):
    from database import db_get_github_token
    token = db_get_github_token(user["username"])
    return {"has_token": bool(token)}


# ── Pipeline runs ─────────────────────────────────────────────────────────

@app.get("/github/runs")
def list_pipeline_runs(user=Depends(require_devops_or_admin)):
    """Get recent CI/CD pipeline runs from GitHub Actions."""
    from database import db_get_github_link, db_get_github_token
    repo_url = db_get_github_link(user["username"])
    token = db_get_github_token(user["username"])
    if not repo_url or not token:
        raise HTTPException(status_code=400, detail="GitHub repo and token required. Configure in DevOps settings.")
    from github_actions import get_workflow_runs
    runs = get_workflow_runs(repo_url, token)
    return runs


@app.get("/github/runs/{run_id}/jobs")
def get_pipeline_jobs(run_id: int, user=Depends(require_devops_or_admin)):
    """Get jobs and steps for a specific pipeline run."""
    from database import db_get_github_link, db_get_github_token
    repo_url = db_get_github_link(user["username"])
    token = db_get_github_token(user["username"])
    if not repo_url or not token:
        raise HTTPException(status_code=400, detail="GitHub repo and token required.")
    from github_actions import get_run_jobs
    return get_run_jobs(repo_url, token, run_id)


@app.get("/github/runs/{run_id}/logs")
def get_pipeline_logs(run_id: int, user=Depends(require_devops_or_admin)):
    """Get download URL for pipeline run logs."""
    from database import db_get_github_link, db_get_github_token
    repo_url = db_get_github_link(user["username"])
    token = db_get_github_token(user["username"])
    if not repo_url or not token:
        raise HTTPException(status_code=400, detail="GitHub repo and token required.")
    from github_actions import get_run_logs
    url = get_run_logs(repo_url, token, run_id)
    if not url:
        raise HTTPException(status_code=404, detail="Logs not available")
    return {"logs_url": url}


@app.post("/github/trigger")
def trigger_pipeline(user=Depends(require_devops_or_admin)):
    """Trigger the CI/CD pipeline manually."""
    from database import db_get_github_link, db_get_github_token
    repo_url = db_get_github_link(user["username"])
    token = db_get_github_token(user["username"])
    if not repo_url or not token:
        raise HTTPException(status_code=400, detail="GitHub repo and token required.")
    from github_actions import trigger_workflow
    success = trigger_workflow(repo_url, token)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to trigger pipeline. Make sure ci.yml has workflow_dispatch enabled.")
    return {"status": "triggered"}