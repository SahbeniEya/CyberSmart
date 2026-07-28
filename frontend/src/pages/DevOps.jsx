// src/pages/DevOps.jsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { githubAPI } from "../api"
import Navbar from "../components/Navbar"

const API = "http://localhost:8000"

function StatusIcon({ status, conclusion }) {
  if (status === "in_progress" || status === "queued")
    return <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse inline-block" title="Running" />
  if (conclusion === "success")
    return <span className="text-green-500 text-sm" title="Success">✓</span>
  if (conclusion === "failure")
    return <span className="text-red-500 text-sm" title="Failed">✗</span>
  return <span className="text-gray-400 text-sm" title={conclusion || status}>●</span>
}

function StatusBadge({ status, conclusion }) {
  if (status === "in_progress" || status === "queued")
    return <span className="text-[10px] font-mono bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">RUNNING</span>
  if (conclusion === "success")
    return <span className="text-[10px] font-mono bg-green-100 dark:bg-green-500/15 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">SUCCESS</span>
  if (conclusion === "failure")
    return <span className="text-[10px] font-mono bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">FAILED</span>
  return <span className="text-[10px] font-mono bg-gray-100 dark:bg-gray-500/15 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full font-bold">{(conclusion || status || "unknown").toUpperCase()}</span>
}

export default function DevOps() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [repoUrl, setRepoUrl]       = useState("")
  const [savedRepo, setSavedRepo]   = useState(null)
  const [ghToken, setGhToken]       = useState("")
  const [hasToken, setHasToken]     = useState(false)
  const [runs, setRuns]             = useState([])
  const [selectedRun, setSelectedRun] = useState(null)
  const [jobs, setJobs]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [runsLoading, setRunsLoading] = useState(false)
  const [msg, setMsg]               = useState("")
  const [triggerLoading, setTriggerLoading] = useState(false)

  const token = () => localStorage.getItem("token")
  const authHeaders = () => ({ "Content-Type": "application/json", "Authorization": `Bearer ${token()}` })

  useEffect(() => {
    if (user?.role !== "devops" && user?.role !== "admin") { navigate("/"); return }
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const [repoRes, tokenRes] = await Promise.all([
        githubAPI.getLink(),
        fetch(`${API}/github/token`, { headers: authHeaders() }).then(r => r.json()),
      ])
      if (repoRes.data.repo_url) {
        setSavedRepo(repoRes.data.repo_url)
        setRepoUrl(repoRes.data.repo_url)
      }
      setHasToken(tokenRes.has_token)
      if (repoRes.data.repo_url && tokenRes.has_token) {
        loadRuns()
      }
    } catch {} finally { setLoading(false) }
  }

  const loadRuns = async () => {
    setRunsLoading(true)
    try {
      const r = await fetch(`${API}/github/runs`, { headers: authHeaders() })
      if (r.ok) setRuns(await r.json())
    } catch {} finally { setRunsLoading(false) }
  }

  const loadJobs = async (runId) => {
    setSelectedRun(runId)
    setJobs([])
    try {
      const r = await fetch(`${API}/github/runs/${runId}/jobs`, { headers: authHeaders() })
      if (r.ok) setJobs(await r.json())
    } catch {}
  }

  const downloadLogs = async (runId) => {
    try {
      const r = await fetch(`${API}/github/runs/${runId}/logs`, { headers: authHeaders() })
      if (r.ok) {
        const data = await r.json()
        if (data.logs_url) window.open(data.logs_url, "_blank")
      }
    } catch {}
  }

  const handleSaveRepo = async () => {
    if (!repoUrl.trim()) return flash("✗ Repository URL required")
    try {
      await githubAPI.setLink(repoUrl.trim())
      setSavedRepo(repoUrl.trim())
      flash("✓ Repository linked")
    } catch { flash("✗ Failed") }
  }

  const handleSaveToken = async () => {
    if (!ghToken.trim()) return flash("✗ Token required")
    try {
      const r = await fetch(`${API}/github/token`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ token: ghToken.trim() })
      })
      if (r.ok) { setHasToken(true); setGhToken(""); flash("✓ Token saved"); loadRuns() }
    } catch { flash("✗ Failed") }
  }

  const handleTrigger = async () => {
    setTriggerLoading(true)
    try {
      const r = await fetch(`${API}/github/trigger`, { method: "POST", headers: authHeaders() })
      if (r.ok) { flash("✓ Pipeline triggered — refreshing..."); setTimeout(loadRuns, 3000) }
      else { const d = await r.json(); flash(`✗ ${d.detail}`) }
    } catch { flash("✗ Failed to trigger") }
    finally { setTriggerLoading(false) }
  }

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 4000) }

  const ciYaml = `name: CyberSmart CI/CD
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
  workflow_dispatch:

jobs:
  backend:
    name: Backend (Python)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: |
          cd backend/backend
          pip install -r requirements.txt sqlalchemy pytest flake8
          flake8 . --select=E9,F63,F7,F82 --statistics
          python -c "from main import app; print('App loaded')"

  frontend:
    name: Frontend (React)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: cd frontend && npm ci && npm run build

  security:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          pip install pip-audit
          cd backend/backend
          pip-audit -r requirements.txt || true
          cd ../../frontend
          npm audit --audit-level=high || true`

  const successCount  = runs.filter(r => r.conclusion === "success").length
  const failedCount   = runs.filter(r => r.conclusion === "failure").length
  const runningCount  = runs.filter(r => r.status === "in_progress" || r.status === "queued").length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">DevOps Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">CI/CD pipeline management & monitoring</p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadRuns} className="btn-secondary text-xs" disabled={runsLoading}>
              {runsLoading ? "..." : "↻ Refresh"}
            </button>
            <button onClick={handleTrigger}
              className="bg-blue-600 text-white text-xs font-mono font-bold px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-40"
              disabled={triggerLoading || !hasToken || !savedRepo}>
              {triggerLoading ? "Triggering..." : "▶ Run Pipeline"}
            </button>
          </div>
        </div>

        {msg && (
          <div className={`mb-4 rounded-lg px-4 py-2 border ${msg.includes("✓") ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20" : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"}`}>
            <span className={`text-sm font-mono ${msg.includes("✓") ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>{msg}</span>
          </div>
        )}

        {/* Stats */}
        {runs.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="card text-center py-3">
              <p className="text-xl font-mono font-bold text-gray-800 dark:text-white">{runs.length}</p>
              <p className="text-[10px] font-mono text-gray-400 uppercase">Total runs</p>
            </div>
            <div className="card text-center py-3">
              <p className="text-xl font-mono font-bold text-green-500">{successCount}</p>
              <p className="text-[10px] font-mono text-gray-400 uppercase">Passed</p>
            </div>
            <div className="card text-center py-3">
              <p className="text-xl font-mono font-bold text-red-500">{failedCount}</p>
              <p className="text-[10px] font-mono text-gray-400 uppercase">Failed</p>
            </div>
            <div className="card text-center py-3">
              <p className="text-xl font-mono font-bold text-blue-500">{runningCount}</p>
              <p className="text-[10px] font-mono text-gray-400 uppercase">Running</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">

          {/* Left 2/3: Pipeline runs + job details */}
          <div className="col-span-2 space-y-4">

            {/* Pipeline execution history */}
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-dark-600 flex items-center justify-between">
                <span className="font-mono text-xs text-gray-400 uppercase tracking-wider">Pipeline History</span>
              </div>

              {loading ? (
                <div className="p-8 text-center font-mono text-gray-400 text-sm">Loading...</div>
              ) : !savedRepo || !hasToken ? (
                <div className="p-8 text-center">
                  <p className="text-gray-400 text-sm font-mono mb-1">Configure repository & token first</p>
                  <p className="text-gray-500 text-xs font-mono">Use the settings panel on the right →</p>
                </div>
              ) : runs.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-400 text-sm font-mono">No pipeline runs yet</p>
                  <p className="text-gray-500 text-xs font-mono mt-1">Push code or click "Run Pipeline" to start</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-dark-700">
                  {runs.map(run => (
                    <div key={run.id}
                      className={`px-5 py-3 hover:bg-gray-50 dark:hover:bg-dark-700/30 cursor-pointer transition-colors ${selectedRun === run.id ? "bg-blue-50/50 dark:bg-blue-500/5" : ""}`}
                      onClick={() => loadJobs(run.id)}>
                      <div className="flex items-center gap-3">
                        <StatusIcon status={run.status} conclusion={run.conclusion} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800 dark:text-white truncate">{run.commit_msg || run.name}</span>
                            <StatusBadge status={run.status} conclusion={run.conclusion} />
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] font-mono text-gray-400">{run.branch}</span>
                            <span className="text-[10px] font-mono text-blue-400">{run.commit_sha}</span>
                            <span className="text-[10px] font-mono text-gray-500">{run.duration}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); downloadLogs(run.id) }}
                            className="text-[10px] font-mono text-gray-400 hover:text-blue-400 transition-colors" title="Download logs">
                            logs
                          </button>
                          <a href={run.url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}
                            className="text-[10px] font-mono text-gray-400 hover:text-blue-400 transition-colors" title="View on GitHub">
                            github ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Job details for selected run */}
            {selectedRun && jobs.length > 0 && (
              <div className="card">
                <h3 className="font-mono text-xs text-gray-400 uppercase mb-3">Jobs — Run #{String(selectedRun).slice(-6)}</h3>
                <div className="space-y-3">
                  {jobs.map(job => (
                    <div key={job.id} className="bg-gray-50 dark:bg-dark-700/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <StatusIcon status={job.status} conclusion={job.conclusion} />
                        <span className="text-sm font-medium text-gray-800 dark:text-white">{job.name}</span>
                        <span className="text-[10px] font-mono text-gray-400 ml-auto">{job.duration}</span>
                      </div>
                      {job.steps?.length > 0 && (
                        <div className="ml-5 space-y-1">
                          {job.steps.map((step, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className={`text-[10px] ${step.conclusion === "success" ? "text-green-500" : step.conclusion === "failure" ? "text-red-500" : "text-gray-400"}`}>
                                {step.conclusion === "success" ? "✓" : step.conclusion === "failure" ? "✗" : "●"}
                              </span>
                              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{step.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right 1/3: Configuration */}
          <div className="space-y-4">

            {/* Repository */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                Repository
              </h3>
              {savedRepo && (
                <div className="mb-2 bg-green-50 dark:bg-green-500/10 rounded-lg px-3 py-1.5">
                  <p className="text-[10px] font-mono text-green-600 dark:text-green-400 truncate">✓ {savedRepo}</p>
                </div>
              )}
              <div className="flex gap-2">
                <input className="input flex-1 text-xs" placeholder="https://github.com/user/repo"
                  value={repoUrl} onChange={e => setRepoUrl(e.target.value)} />
                <button onClick={handleSaveRepo} className="bg-blue-600 text-white text-xs font-mono font-bold px-3 py-2 rounded-lg hover:bg-blue-500 shrink-0">Link</button>
              </div>
            </div>

            {/* GitHub Token */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">GitHub Token</h3>
              {hasToken ? (
                <div className="mb-2 bg-green-50 dark:bg-green-500/10 rounded-lg px-3 py-1.5">
                  <p className="text-[10px] font-mono text-green-600 dark:text-green-400">✓ Token configured</p>
                </div>
              ) : (
                <p className="text-[10px] text-gray-400 font-mono mb-2">Required for pipeline access. Generate at GitHub → Settings → Developer settings → Personal access tokens → tokens (classic). Scope: <span className="text-blue-400">repo, workflow</span></p>
              )}
              <div className="flex gap-2">
                <input className="input flex-1 text-xs" type="password" placeholder={hasToken ? "••••••••" : "ghp_xxxxxxxxxxxx"}
                  value={ghToken} onChange={e => setGhToken(e.target.value)} />
                <button onClick={handleSaveToken} className="bg-blue-600 text-white text-xs font-mono font-bold px-3 py-2 rounded-lg hover:bg-blue-500 shrink-0">Save</button>
              </div>
            </div>

            {/* CI/CD Workflow */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Workflow</h3>
                <button onClick={() => {
                  const blob = new Blob([ciYaml], { type: "text/yaml" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a"); a.href = url; a.download = "ci.yml"; a.click()
                }} className="text-[10px] font-mono text-blue-500 hover:underline">↓ Download ci.yml</button>
              </div>
              <div className="bg-gray-900 dark:bg-dark-700 rounded-lg p-3 overflow-auto max-h-48">
                <pre className="text-[10px] font-mono text-green-400 whitespace-pre leading-relaxed">{ciYaml}</pre>
              </div>
              <p className="text-[9px] text-gray-400 font-mono mt-2">
                Place in .github/workflows/ci.yml
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
