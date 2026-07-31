// src/pages/Monitoring.jsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import Navbar from "../components/Navbar"

const API = "http://localhost:8000"

function StatusDot({ status }) {
  const colors = {
    up: "bg-green-500", connected: "bg-green-500", running: "bg-green-500",
    down: "bg-red-500", disconnected: "bg-red-500", error: "bg-red-500",
    not_installed: "bg-gray-500", timeout: "bg-yellow-500",
  }
  return (
    <span className={`w-2.5 h-2.5 rounded-full inline-block ${colors[status] || "bg-gray-500"} ${
      status === "running" || status === "connected" || status === "up" ? "animate-pulse" : ""
    }`} />
  )
}

function MetricCard({ label, value, sub, color = "text-white" }) {
  return (
    <div className="bg-white/60 dark:bg-dark-800/60 backdrop-blur-sm border border-gray-100 dark:border-dark-700 rounded-lg p-4 relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${
        color === "text-blue-500" ? "bg-blue-500" :
        color === "text-green-500" ? "bg-green-500" :
        color === "text-yellow-500" ? "bg-yellow-500" :
        color === "text-red-500" ? "bg-red-500" :
        "bg-gray-500"
      }`} />
      <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-mono font-bold tabular-nums ${color} dark:${color.replace("500", "400")}`}>{value}</p>
      {sub && <p className="text-[10px] font-mono text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function MiniBar({ data, maxVal }) {
  const h = maxVal > 0 ? Math.max((data / maxVal) * 100, 5) : 5
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-8 bg-gray-100 dark:bg-dark-700 rounded-sm overflow-hidden" style={{ height: "60px" }}>
        <div className="w-full bg-blue-500 rounded-sm transition-all duration-500"
          style={{ height: `${h}%`, marginTop: `${100 - h}%` }} />
      </div>
    </div>
  )
}

export default function Monitoring() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)

  const token = () => localStorage.getItem("token")

  const loadData = async () => {
    try {
      const r = await fetch(`${API}/monitoring`, {
        headers: { "Authorization": `Bearer ${token()}` }
      })
      if (r.ok) {
        const d = await r.json()
        setData(d)
        setLastRefresh(new Date())
      }
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000) // Auto-refresh every 5s
    return () => clearInterval(interval)
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <span className="font-mono text-gray-400 text-sm animate-pulse">Loading monitoring data...</span>
      </div>
    </div>
  )

  const d = data
  const maxDuration = Math.max(...(d?.scans?.trends?.map(t => t.duration_seconds) || [1]), 1)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Monitoring</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Real-time platform health & metrics
              {lastRefresh && (
                <span className="ml-2 text-xs text-gray-400">· refreshed {lastRefresh.toLocaleTimeString()}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-green-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> LIVE
            </span>
            <button onClick={loadData} className="btn-secondary text-xs">↻ Refresh</button>
          </div>
        </div>

        {/* Service status row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="card flex items-center gap-3">
            <StatusDot status={d?.backend?.status} />
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-white">Backend</p>
              <p className="text-[10px] font-mono text-gray-400">{d?.backend?.uptime || "—"}</p>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <StatusDot status={d?.ollama?.status} />
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-white">Ollama LLM</p>
              <p className="text-[10px] font-mono text-gray-400">
                {d?.ollama?.status === "connected" ? `${d.ollama.latency_ms}ms · ${d.ollama.model_count} models` : d?.ollama?.status}
              </p>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <StatusDot status={d?.docker?.status} />
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-white">Docker</p>
              <p className="text-[10px] font-mono text-gray-400">
                {d?.docker?.status === "running" ? `${d.docker.running_containers} containers` : d?.docker?.status}
              </p>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <span className="text-blue-500 text-lg font-mono font-bold">{d?.websocket_connections || 0}</span>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-white">WebSocket</p>
              <p className="text-[10px] font-mono text-gray-400">active connections</p>
            </div>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          <MetricCard label="Total scans" value={d?.scans?.total || 0} color="text-blue-500" />
          <MetricCard label="Running" value={d?.scans?.running || 0} color="text-green-500" />
          <MetricCard label="Finished" value={d?.scans?.finished || 0} color="text-blue-500" />
          <MetricCard label="Errors" value={d?.scans?.error || 0} color="text-red-500" />
          <MetricCard label="WebSocket" value={d?.websocket_connections || 0} sub="connections" color="text-yellow-500" />
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">

          {/* Left: Scan duration trends */}
          <div className="col-span-2">
            <div className="card">
              <h3 className="font-mono text-xs text-gray-400 uppercase mb-4">Scan Duration Trends (Last 5)</h3>
              {d?.scans?.trends?.length > 0 ? (
                <div className="flex items-end gap-4">
                  {d.scans.trends.slice().reverse().map((t, i) => (
                    <div key={i} className="flex-1 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {/* Bar */}
                        <div className="w-full bg-gray-100 dark:bg-dark-700 rounded-md overflow-hidden" style={{ height: "120px", position: "relative" }}>
                          <div
                            className={`w-full rounded-md transition-all duration-700 absolute bottom-0 ${
                              t.status === "error" ? "bg-red-500" :
                              t.cvss_max >= 9 ? "bg-red-500" :
                              t.cvss_max >= 7 ? "bg-orange-500" :
                              "bg-blue-500"
                            }`}
                            style={{ height: `${Math.max((t.duration_seconds / maxDuration) * 100, 8)}%` }}
                          />
                        </div>
                        {/* Labels */}
                        <span className="text-[10px] font-mono text-gray-500 font-bold">{t.duration_seconds}s</span>
                        <span className="text-[9px] font-mono text-gray-400 truncate max-w-full">{t.target}</span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                          t.agent_type === "ad" ? "bg-yellow-100 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" :
                          "bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"
                        }`}>{t.agent_type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 font-mono text-center py-8">No scan data yet</p>
              )}
            </div>
          </div>

          {/* Right: Agent distribution */}
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-mono text-xs text-gray-400 uppercase mb-3">Agent Distribution</h3>
              {(() => {
                const web = d?.scans?.agent_distribution?.web || 0
                const ad = d?.scans?.agent_distribution?.ad || 0
                const total = web + ad || 1
                return (
                  <div>
                    <div className="flex h-4 rounded-full overflow-hidden bg-gray-100 dark:bg-dark-700 mb-3">
                      {web > 0 && <div className="bg-blue-500 h-full transition-all" style={{ width: `${(web/total)*100}%` }} />}
                      {ad > 0 && <div className="bg-yellow-500 h-full transition-all" style={{ width: `${(ad/total)*100}%` }} />}
                    </div>
                    <div className="flex justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded bg-blue-500" />
                        <span className="text-xs font-mono text-gray-500">Web — {web}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded bg-yellow-500" />
                        <span className="text-xs font-mono text-gray-500">AD — {ad}</span>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Ollama Models */}
            <div className="card">
              <h3 className="font-mono text-xs text-gray-400 uppercase mb-3">LLM Models</h3>
              {d?.ollama?.models?.length > 0 ? (
                <div className="space-y-2">
                  {d.ollama.models.map((m, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-dark-700/50 rounded-lg px-3 py-2">
                      <span className="text-xs font-mono font-medium text-gray-800 dark:text-white">{m.name}</span>
                      <span className="text-[10px] font-mono text-gray-400">{m.size_gb} GB</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 font-mono">No models available</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">

          {/* Live scans feed */}
          <div className="card">
            <h3 className="font-mono text-xs text-gray-400 uppercase mb-3 flex items-center gap-2">
              Live Scans
              {d?.scans?.live?.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </h3>
            {d?.scans?.live?.length > 0 ? (
              <div className="space-y-2">
                {d.scans.live.map((s, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-dark-700/50 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                    onClick={() => navigate(`/scan/${s.scan_id}`)}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-medium text-blue-500 dark:text-blue-400">{s.scan_id}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        s.agent_type === "ad" ? "bg-yellow-100 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" :
                        "bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"
                      }`}>{s.agent_type}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-gray-500 truncate max-w-[60%]">{s.target}</span>
                      <span className="text-[10px] font-mono text-gray-400">
                        step {s.current_step}/{s.max_steps} · {s.last_tool}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 rounded-full bg-gray-200 dark:bg-dark-600 mt-2 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full animate-pulse transition-all"
                        style={{ width: `${(s.current_step / s.max_steps) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs font-mono text-gray-400">No active scans</p>
                <p className="text-[10px] font-mono text-gray-500 mt-1">Start a scan to see live progress</p>
              </div>
            )}
          </div>

          {/* System info */}
          <div className="card">
            <h3 className="font-mono text-xs text-gray-400 uppercase mb-3">System Information</h3>
            <div className="space-y-2">
              {[
                { label: "Hostname", value: d?.system?.hostname },
                { label: "OS", value: d?.system?.os_full },
                { label: "Python", value: d?.system?.python },
                { label: "CPU Cores", value: d?.system?.cpu_count },
                { label: "Docker", value: d?.docker?.version || d?.docker?.status },
                { label: "Ollama URL", value: d?.ollama?.url },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-dark-700 last:border-0">
                  <span className="text-[10px] font-mono text-gray-400 uppercase">{item.label}</span>
                  <span className="text-xs font-mono text-gray-700 dark:text-gray-300 text-right max-w-[60%] truncate">{item.value || "—"}</span>
                </div>
              ))}
              {/* Disk usage bar */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-gray-400 uppercase">Disk</span>
                  <span className="text-[10px] font-mono text-gray-500">
                    {d?.system?.disk_used_gb} / {d?.system?.disk_total_gb} GB ({d?.system?.disk_percent}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-dark-700 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${
                    (d?.system?.disk_percent || 0) > 90 ? "bg-red-500" :
                    (d?.system?.disk_percent || 0) > 70 ? "bg-yellow-500" :
                    "bg-blue-500"
                  }`} style={{ width: `${d?.system?.disk_percent || 0}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
