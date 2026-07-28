# database.py — SQLite persistence layer
# Stores users, scans, and github links. Survives backend restarts.

import json
import hashlib
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Float, Integer, Text, DateTime
from sqlalchemy.orm import DeclarativeBase, Session

DB_PATH = "pentest.db"
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})


class Base(DeclarativeBase):
    pass


# ── User model ─────────────────────────────────────────────────────────────

class UserRecord(Base):
    __tablename__ = "users"

    username  = Column(String(100), primary_key=True)
    email     = Column(String(300), unique=True, nullable=False)
    password  = Column(String(300), nullable=False)  # hashed
    role      = Column(String(20),  default="pentester")  # admin | pentester | devops
    created_at = Column(DateTime,   default=datetime.now)

    def to_dict(self) -> dict:
        return {
            "username":   self.username,
            "email":      self.email,
            "role":       self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ── Scan model ─────────────────────────────────────────────────────────────

class ScanRecord(Base):
    __tablename__ = "scans"

    scan_id          = Column(String(16),  primary_key=True)
    target           = Column(String(500), nullable=False)
    model            = Column(String(100))
    agent_type       = Column(String(20))
    status           = Column(String(20),  default="running")
    started_by       = Column(String(100), nullable=False)
    started_at       = Column(DateTime,    default=datetime.now)
    finished_at      = Column(DateTime,    nullable=True)

    steps_json                  = Column(Text, default="[]")
    open_ports_json             = Column(Text, default="[]")
    services_json               = Column(Text, default="[]")
    vulnerabilities_json        = Column(Text, default="[]")
    orchestrator_decisions_json = Column(Text, default="[]")

    cvss_max          = Column(Float,   default=0.0)
    error             = Column(Text,    nullable=True)

    def to_dict(self) -> dict:
        return {
            "scan_id":                 self.scan_id,
            "target":                  self.target,
            "model":                   self.model,
            "agent_type":              self.agent_type,
            "status":                  self.status,
            "started_by":              self.started_by,
            "started_at":              self.started_at.isoformat() if self.started_at else None,
            "finished_at":             self.finished_at.isoformat() if self.finished_at else None,
            "steps":                   json.loads(self.steps_json or "[]"),
            "open_ports":              json.loads(self.open_ports_json or "[]"),
            "services":                json.loads(self.services_json or "[]"),
            "vulnerabilities":         json.loads(self.vulnerabilities_json or "[]"),
            "orchestrator_decisions":  json.loads(self.orchestrator_decisions_json or "[]"),
            "cvss_max":                self.cvss_max or 0.0,
            "error":                   self.error,
        }


class GithubLink(Base):
    __tablename__ = "github_links"

    username = Column(String(100), primary_key=True)
    repo_url = Column(String(500), nullable=False)
    token    = Column(String(500), nullable=True)


# ── Create tables on startup ───────────────────────────────────────────────
Base.metadata.create_all(engine)


# ── Password hashing ──────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed


# ── User functions ─────────────────────────────────────────────────────────

def db_create_user(username: str, email: str, password: str, role: str = "pentester") -> dict | None:
    with Session(engine) as s:
        if s.get(UserRecord, username):
            return None  # username taken
        existing_email = s.query(UserRecord).filter(UserRecord.email == email).first()
        if existing_email:
            return None  # email taken
        user = UserRecord(
            username=username,
            email=email,
            password=hash_password(password),
            role=role,
        )
        s.add(user)
        s.commit()
        s.refresh(user)
        return user.to_dict()


def db_get_user(username: str) -> dict | None:
    with Session(engine) as s:
        user = s.get(UserRecord, username)
        if not user:
            return None
        return {**user.to_dict(), "password": user.password}


def db_list_users() -> list[dict]:
    with Session(engine) as s:
        return [u.to_dict() for u in s.query(UserRecord).order_by(UserRecord.created_at.desc()).all()]


def db_update_user(username: str, updates: dict) -> dict | None:
    with Session(engine) as s:
        user = s.get(UserRecord, username)
        if not user:
            return None
        if "role" in updates:
            user.role = updates["role"]
        if "email" in updates:
            user.email = updates["email"]
        if "password" in updates:
            user.password = hash_password(updates["password"])
        s.commit()
        s.refresh(user)
        return user.to_dict()


def db_delete_user(username: str) -> bool:
    with Session(engine) as s:
        user = s.get(UserRecord, username)
        if not user:
            return False
        s.delete(user)
        s.commit()
        return True


# ── Seed default users ─────────────────────────────────────────────────────

def seed_default_users():
    defaults = [
        {"username": "admin",  "email": "admin@cybersmart.local",  "password": "admin123",  "role": "admin"},
        {"username": "eya",    "email": "eya@cybersmart.local",    "password": "eya123",    "role": "pentester"},
        {"username": "devops", "email": "devops@cybersmart.local", "password": "devops123", "role": "devops"},
    ]
    for u in defaults:
        with Session(engine) as s:
            if not s.get(UserRecord, u["username"]):
                s.add(UserRecord(
                    username=u["username"],
                    email=u["email"],
                    password=hash_password(u["password"]),
                    role=u["role"],
                ))
                s.commit()

seed_default_users()


# ── Scan functions ─────────────────────────────────────────────────────────

def db_create_scan(scan: dict) -> None:
    with Session(engine) as s:
        started_at = scan.get("started_at")
        if isinstance(started_at, str):
            try:
                started_at = datetime.fromisoformat(started_at)
            except Exception:
                started_at = datetime.now()

        record = ScanRecord(
            scan_id     = scan["scan_id"],
            target      = scan["target"],
            model       = scan.get("model"),
            agent_type  = scan.get("agent_type", "unknown"),
            status      = scan.get("status", "running"),
            started_by  = scan.get("started_by", ""),
            started_at  = started_at,
            steps_json                  = json.dumps(scan.get("steps", [])),
            open_ports_json             = json.dumps(scan.get("open_ports", [])),
            services_json               = json.dumps(scan.get("services", [])),
            vulnerabilities_json        = json.dumps(scan.get("vulnerabilities", [])),
            orchestrator_decisions_json = json.dumps(scan.get("orchestrator_decisions", [])),
            cvss_max          = scan.get("cvss_max", 0.0),
        )
        s.add(record)
        s.commit()


def db_update_scan(scan_id: str, updates: dict) -> None:
    with Session(engine) as s:
        rec = s.get(ScanRecord, scan_id)
        if not rec:
            return
        for key, value in updates.items():
            if key == "steps":
                rec.steps_json = json.dumps(value)
            elif key == "open_ports":
                rec.open_ports_json = json.dumps(value)
            elif key == "services":
                rec.services_json = json.dumps(value)
            elif key == "vulnerabilities":
                rec.vulnerabilities_json = json.dumps(value)
            elif key == "orchestrator_decisions":
                rec.orchestrator_decisions_json = json.dumps(value)
            elif key == "finished_at":
                if isinstance(value, str):
                    try:
                        rec.finished_at = datetime.fromisoformat(value)
                    except Exception:
                        rec.finished_at = datetime.now()
                else:
                    rec.finished_at = value
            elif hasattr(rec, key):
                setattr(rec, key, value)
        s.commit()


def db_get_scan(scan_id: str) -> dict | None:
    with Session(engine) as s:
        rec = s.get(ScanRecord, scan_id)
        return rec.to_dict() if rec else None


def db_list_scans(username: str | None = None) -> list[dict]:
    with Session(engine) as s:
        q = s.query(ScanRecord)
        if username:
            q = q.filter(ScanRecord.started_by == username)
        q = q.order_by(ScanRecord.started_at.desc())
        return [r.to_dict() for r in q.all()]


def db_set_github_link(username: str, repo_url: str) -> None:
    with Session(engine) as s:
        link = s.get(GithubLink, username)
        if link:
            link.repo_url = repo_url
        else:
            s.add(GithubLink(username=username, repo_url=repo_url))
        s.commit()


def db_get_github_link(username: str) -> str | None:
    with Session(engine) as s:
        link = s.get(GithubLink, username)
        return link.repo_url if link else None


def db_set_github_token(username: str, token: str) -> None:
    with Session(engine) as s:
        link = s.get(GithubLink, username)
        if link:
            link.token = token
        else:
            s.add(GithubLink(username=username, repo_url="", token=token))
        s.commit()


def db_get_github_token(username: str) -> str | None:
    with Session(engine) as s:
        link = s.get(GithubLink, username)
        return link.token if link else None
