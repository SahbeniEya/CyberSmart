# notifications.py — Real-time notification system
# Generates notifications on scan events and delivers them via API

from datetime import datetime
from database import engine, Base
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text
from sqlalchemy.orm import Session


class NotificationRecord(Base):
    __tablename__ = "notifications"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    username   = Column(String(100), nullable=False, index=True)
    type       = Column(String(50), nullable=False)   # scan_started, scan_finished, critical_vuln, scan_error, pipeline_triggered, pipeline_failed
    title      = Column(String(300), nullable=False)
    message    = Column(Text, nullable=True)
    scan_id    = Column(String(16), nullable=True)
    read       = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)

    def to_dict(self) -> dict:
        return {
            "id":         self.id,
            "type":       self.type,
            "title":      self.title,
            "message":    self.message,
            "scan_id":    self.scan_id,
            "read":       self.read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# Create table
Base.metadata.create_all(engine)


# ── Notification creators ──────────────────────────────────────────────

def notify_scan_started(username: str, scan_id: str, target: str):
    _create(username, "scan_started", "Scan started",
            f"Scan {scan_id[:8]} started on {target}", scan_id)


def notify_scan_finished(username: str, scan_id: str, target: str, vuln_count: int, cvss_max: float):
    risk = "CRITICAL" if cvss_max >= 9 else "HIGH" if cvss_max >= 7 else "MEDIUM" if cvss_max >= 4 else "LOW"
    _create(username, "scan_finished", f"Scan finished — {risk}",
            f"{vuln_count} vulnerabilities found on {target} (CVSS {cvss_max:.1f})", scan_id)


def notify_critical_vuln(username: str, scan_id: str, target: str, cvss: float):
    _create(username, "critical_vuln", "Critical vulnerability detected",
            f"CVSS {cvss:.1f} found on {target}", scan_id)


def notify_scan_error(username: str, scan_id: str, target: str, error: str):
    _create(username, "scan_error", "Scan failed",
            f"Scan on {target} failed: {error[:100]}", scan_id)


def notify_pipeline_triggered(username: str):
    _create(username, "pipeline_triggered", "Pipeline triggered",
            "CI/CD pipeline manually triggered from DevOps dashboard", None)


def notify_pipeline_status(username: str, conclusion: str, commit_msg: str):
    if conclusion == "failure":
        _create(username, "pipeline_failed", "Pipeline failed",
                f"CI/CD pipeline failed: {commit_msg[:80]}", None)
    elif conclusion == "success":
        _create(username, "pipeline_success", "Pipeline passed",
                f"CI/CD pipeline succeeded: {commit_msg[:80]}", None)


def _create(username: str, ntype: str, title: str, message: str, scan_id: str | None):
    with Session(engine) as s:
        n = NotificationRecord(
            username=username, type=ntype, title=title,
            message=message, scan_id=scan_id,
        )
        s.add(n)
        s.commit()


# ── Query functions ────────────────────────────────────────────────────

def get_notifications(username: str, limit: int = 20) -> list[dict]:
    with Session(engine) as s:
        notifs = s.query(NotificationRecord) \
            .filter(NotificationRecord.username == username) \
            .order_by(NotificationRecord.created_at.desc()) \
            .limit(limit).all()
        return [n.to_dict() for n in notifs]


def get_unread_count(username: str) -> int:
    with Session(engine) as s:
        return s.query(NotificationRecord) \
            .filter(NotificationRecord.username == username,
                    NotificationRecord.read == False).count()


def mark_as_read(username: str, notif_id: int) -> bool:
    with Session(engine) as s:
        n = s.query(NotificationRecord) \
            .filter(NotificationRecord.id == notif_id,
                    NotificationRecord.username == username).first()
        if not n:
            return False
        n.read = True
        s.commit()
        return True


def mark_all_read(username: str) -> int:
    with Session(engine) as s:
        count = s.query(NotificationRecord) \
            .filter(NotificationRecord.username == username,
                    NotificationRecord.read == False) \
            .update({"read": True})
        s.commit()
        return count


def delete_notification(username: str, notif_id: int) -> bool:
    with Session(engine) as s:
        n = s.query(NotificationRecord) \
            .filter(NotificationRecord.id == notif_id,
                    NotificationRecord.username == username).first()
        if not n:
            return False
        s.delete(n)
        s.commit()
        return True