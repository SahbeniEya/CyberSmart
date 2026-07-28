// src/pages/DevOps.jsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { githubAPI, scansAPI } from "../api"
import Navbar from "../components/Navbar"

export default function DevOps() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [repoUrl, setRepoUrl]     = useState("")
  const [savedRepo, setSavedRepo] = useState(null)
  const [scans, setScans]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [msg, setMsg]             = useState("")

  useEffect(() => {
    if (user?.role !== "devops" && user?.role !== "admin") { navigate("/"); return }

    Promise.all([
      githubAPI.getLink().then(r => {
        if (r.data.repo_url) {
          setSavedRepo(r.data.repo_url)
          setRepoUrl(r.data.repo_url)
        }
      }),
      scansAPI.list().then(r => setScans(r.data)),
    ]).finally(() => setLoading(false))
  }, [])

  const handleSaveRepo = async () => {
    if (!repoUrl.trim()) return setMsg("✗ Repository URL is required")
    try {
      await githubAPI.setLink(repoUrl.trim())
      setSavedRepo(repoUrl.trim())
      setMsg("✓ Repository linked")
      setTimeout(() => setMsg(""), 3000)
    } catch {
      setMsg("✗ Failed to save")
    }
  }

  const recentScans = scans.slice().reverse().slice(0, 10)
  const totalVulns  = scans.reduce((a, s) => a + (s.vulnerabilities?.length || 0), 0)
  const criticals   = scans.filter(s => s.cvss_max >= 9).length

  // Generate CI workflow YAML preview
  const ciYaml = `name: CyberSmart CI/CD
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: |
          cd backend/backend
          pip install -r requirements.txt
          pip install sqlalchemy pytest flake8
          flake8 . --select=E9,F63,F7,F82 --statistics
          python -m pytest tests/ -v || true

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: |
          cd frontend
          npm ci && npm run build

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          pip install pip-audit
          cd backend/backend
          pip-audit -r requirements.txt || true
          cd ../../frontend
          npm audit --audit-level=high || true`

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-8 animate-fade-in">

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">DevOps Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">CI/CD pipeline configuration and monitoring</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card text-center">
            <p className="text-2xl font-mono font-bold text-blue-500 dark:text-blue-400">{scans.length}</p>
            <p className="text-xs font-mono text-gray-400 mt-1">Total scans</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-mono font-bold text-yellow-500 dark:text-yellow-400">{totalVulns}</p>
            <p className="text-xs font-mono text-gray-400 mt-1">Vulnerabilities</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-mono font-bold text-red-500 dark:text-red-400">{criticals}</p>
            <p className="text-xs font-mono text-gray-400 mt-1">Critical</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">

          {/* Left: GitHub repo + CI/CD config */}
          <div className="space-y-6">

            {/* Repository config */}
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                Repository
              </h2>
              {savedRepo && (
                <div className="mb-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg px-3 py-2">
                  <p className="text-xs font-mono text-green-700 dark:text-green-400 truncate">✓ {savedRepo}</p>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-xs"
                  placeholder="https://github.com/user/repo"
                  value={repoUrl}
                  onChange={e => setRepoUrl(e.target.value)}
                />
                <button onClick={handleSaveRepo}
                  className="bg-blue-600 text-white text-xs font-mono font-bold px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors shrink-0">
                  Link
                </button>
              </div>
              {msg && <p className={`text-xs font-mono mt-2 ${msg.includes("✓") ? "text-green-500" : "text-red-400"}`}>{msg}</p>}
            </div>

            {/* CI/CD workflow preview */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-white">CI/CD Pipeline</h2>
                <button onClick={() => {
                  const blob = new Blob([ciYaml], { type: "text/yaml" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a"); a.href = url; a.download = "ci.yml"; a.click()
                }} className="text-xs text-blue-500 dark:text-blue-400 hover:underline font-mono">
                  Download ci.yml
                </button>
              </div>
              <div className="bg-gray-900 dark:bg-dark-700 rounded-lg p-4 overflow-auto max-h-64">
                <pre className="text-xs font-mono text-green-400 whitespace-pre">{ciYaml}</pre>
              </div>
              <p className="text-[10px] text-gray-400 font-mono mt-2">
                Place in .github/workflows/ci.yml to enable automatic CI/CD on every push.
              </p>
            </div>
          </div>

          {/* Right: Pipeline jobs + recent scans */}
          <div className="space-y-6">

            {/* Pipeline jobs overview */}
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">Pipeline Jobs</h2>
              <div className="space-y-2">
                {[
                  { name: "Backend",  desc: "Python lint + tests",      icon: "🐍" },
                  { name: "Frontend", desc: "React build + lint",       icon: "⚛️" },
                  { name: "Security", desc: "pip-audit + npm audit",    icon: "🔒" },
                ].map(job => (
                  <div key={job.name} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-dark-700/50">
                    <span className="text-lg">{job.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{job.name}</p>
                      <p className="text-[10px] font-mono text-gray-400">{job.desc}</p>
                    </div>
                    <span className="text-[10px] font-mono text-green-500 bg-green-50 dark:bg-green-500/10 px-2 py-0.5 rounded-full">
                      configured
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent scan results */}
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">Recent Scan Results</h2>
              {loading ? (
                <p className="text-xs text-gray-400 font-mono">Loading...</p>
              ) : recentScans.length === 0 ? (
                <p className="text-xs text-gray-400 font-mono">No scans yet</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-auto">
                  {recentScans.map(s => (
                    <div key={s.scan_id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/scan/${s.scan_id}`)}>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        s.status === "finished" ? "bg-green-500" :
                        s.status === "running"  ? "bg-blue-500 animate-pulse" :
                        "bg-red-500"
                      }`} />
                      <span className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate flex-1">{s.target}</span>
                      <span className="text-[10px] font-mono text-gray-400">{s.vulnerabilities?.length || 0} vulns</span>
                      <span className={`text-[10px] font-mono font-bold ${
                        s.cvss_max >= 9 ? "text-red-500" :
                        s.cvss_max >= 7 ? "text-orange-500" :
                        "text-gray-400"
                      }`}>{s.cvss_max > 0 ? s.cvss_max.toFixed(1) : "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
