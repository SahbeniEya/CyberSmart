# github_actions.py — GitHub Actions integration
# Add these endpoints to main.py or import as a router
#
# Requires: pip install requests
# Uses GitHub Personal Access Token stored in the database via /github/token endpoint

import requests
from datetime import datetime


GITHUB_API = "https://api.github.com"


def _parse_repo(repo_url: str) -> tuple[str, str] | None:
    """Extract owner/repo from a GitHub URL."""
    # https://github.com/owner/repo or https://github.com/owner/repo.git
    repo_url = repo_url.rstrip("/").replace(".git", "")
    parts = repo_url.split("github.com/")
    if len(parts) != 2:
        return None
    segments = parts[1].split("/")
    if len(segments) < 2:
        return None
    return segments[0], segments[1]


def _headers(token: str) -> dict:
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def get_workflow_runs(repo_url: str, token: str, per_page: int = 15) -> list[dict]:
    """Get recent workflow runs from GitHub Actions."""
    parsed = _parse_repo(repo_url)
    if not parsed:
        return []
    owner, repo = parsed
    try:
        r = requests.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/actions/runs",
            headers=_headers(token),
            params={"per_page": per_page},
            timeout=10,
        )
        if r.status_code != 200:
            return []
        runs = r.json().get("workflow_runs", [])
        return [{
            "id":          run["id"],
            "name":        run["name"],
            "status":      run["status"],        # queued, in_progress, completed
            "conclusion":  run["conclusion"],     # success, failure, cancelled, null
            "branch":      run["head_branch"],
            "commit_msg":  run["head_commit"]["message"][:80] if run.get("head_commit") else "",
            "commit_sha":  run["head_sha"][:7],
            "started_at":  run["created_at"],
            "duration":    _calc_duration(run["created_at"], run.get("updated_at")),
            "url":         run["html_url"],
        } for run in runs]
    except Exception as e:
        print(f"   ⚠️ GitHub API error: {e}")
        return []


def get_run_jobs(repo_url: str, token: str, run_id: int) -> list[dict]:
    """Get jobs for a specific workflow run."""
    parsed = _parse_repo(repo_url)
    if not parsed:
        return []
    owner, repo = parsed
    try:
        r = requests.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/actions/runs/{run_id}/jobs",
            headers=_headers(token),
            timeout=10,
        )
        if r.status_code != 200:
            return []
        jobs = r.json().get("jobs", [])
        return [{
            "id":         job["id"],
            "name":       job["name"],
            "status":     job["status"],
            "conclusion": job["conclusion"],
            "started_at": job["started_at"],
            "duration":   _calc_duration(job["started_at"], job.get("completed_at")),
            "steps": [{
                "name":       s["name"],
                "status":     s["status"],
                "conclusion": s["conclusion"],
            } for s in job.get("steps", [])],
        } for job in jobs]
    except Exception as e:
        print(f"   ⚠️ GitHub API error: {e}")
        return []


def get_run_logs(repo_url: str, token: str, run_id: int) -> str:
    """Get logs for a workflow run (returns URL to download)."""
    parsed = _parse_repo(repo_url)
    if not parsed:
        return ""
    owner, repo = parsed
    try:
        r = requests.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/actions/runs/{run_id}/logs",
            headers=_headers(token),
            timeout=10,
            allow_redirects=False,
        )
        if r.status_code == 302:
            return r.headers.get("Location", "")
        return ""
    except:
        return ""


def trigger_workflow(repo_url: str, token: str, branch: str = "main") -> bool:
    """Trigger the CI/CD workflow manually via workflow_dispatch."""
    parsed = _parse_repo(repo_url)
    if not parsed:
        return False
    owner, repo = parsed
    try:
        # Find the ci.yml workflow ID
        r = requests.get(
            f"{GITHUB_API}/repos/{owner}/{repo}/actions/workflows",
            headers=_headers(token),
            timeout=10,
        )
        if r.status_code != 200:
            return False

        workflows = r.json().get("workflows", [])
        ci_workflow = next((w for w in workflows if "ci" in w["name"].lower() or "ci.yml" in w["path"]), None)
        if not ci_workflow:
            return False

        # Dispatch
        r2 = requests.post(
            f"{GITHUB_API}/repos/{owner}/{repo}/actions/workflows/{ci_workflow['id']}/dispatches",
            headers=_headers(token),
            json={"ref": branch},
            timeout=10,
        )
        return r2.status_code == 204
    except:
        return False


def _calc_duration(start: str | None, end: str | None) -> str:
    if not start or not end:
        return "—"
    try:
        s = datetime.fromisoformat(start.replace("Z", "+00:00"))
        e = datetime.fromisoformat(end.replace("Z", "+00:00"))
        secs = int((e - s).total_seconds())
        if secs < 60:
            return f"{secs}s"
        return f"{secs // 60}m {secs % 60}s"
    except:
        return "—"