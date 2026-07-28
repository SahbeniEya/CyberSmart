// src/pages/Dashboard.jsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { scansAPI } from "../api"
import Navbar from "../components/Navbar"
import logoImg from "../assets/logo.png"

function StatusBadge({ status }) {
  const map = {
    running:  { cls: "badge-running",  label: "● running"  },
    finished: { cls: "badge-finished", label: "✓ done" },
    error:    { cls: "badge-error",    label: "✗ error"    },
  }
  const { cls, label } = map[status] || map.error
  return <span className={cls}>{label}</span>
}

function Metric({ value, label, accent = "text-gray-800 dark:text-gray-100" }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className={`text-2xl font-mono font-bold tabular-nums ${accent}`}>{value}</span>
      <span className="text-xs font-mono text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
  )
}

function SeverityBar({ scans }) {
  const critical = scans.filter(s => s.cvss_max >= 9).length
  const high     = scans.filter(s => s.cvss_max >= 7 && s.cvss_max < 9).length
  const medium   = scans.filter(s => s.cvss_max >= 4 && s.cvss_max < 7).length
  const low      = scans.filter(s => s.cvss_max > 0 && s.cvss_max < 4).length
  const total    = critical + high + medium + low || 1

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-dark-700 overflow-hidden flex">
        {critical > 0 && <div className="bg-red-500 h-full" style={{ width: `${(critical/total)*100}%` }} />}
        {high > 0     && <div className="bg-orange-500 h-full" style={{ width: `${(high/total)*100}%` }} />}
        {medium > 0   && <div className="bg-yellow-500 h-full" style={{ width: `${(medium/total)*100}%` }} />}
        {low > 0      && <div className="bg-blue-400 h-full" style={{ width: `${(low/total)*100}%` }} />}
      </div>
      <div className="flex gap-3 text-xs font-mono">
        {critical > 0 && <span className="text-red-500">{critical}C</span>}
        {high > 0     && <span className="text-orange-500">{high}H</span>}
        {medium > 0   && <span className="text-yellow-500">{medium}M</span>}
        {low > 0      && <span className="text-blue-500">{low}L</span>}
      </div>
    </div>
  )
}

/* Geometric background — works in both light and dark mode */
function GeoBg() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-indigo-50/30
                       dark:from-blue-950/20 dark:via-transparent dark:to-indigo-950/10" />

      {/* Hex grid pattern */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.08] dark:opacity-[0.05]">
        <defs>
          <pattern id="hexgrid" width="56" height="49" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
            <path d="M28 0L56 14L56 35L28 49L0 35L0 14Z" fill="none"
              stroke="currentColor" strokeWidth="0.5"
              className="text-blue-400 dark:text-blue-500"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hexgrid)" />
      </svg>

      {/* Floating shapes */}
      <div className="absolute top-[10%] left-[8%] w-40 h-40 rounded-full
                       bg-blue-200/30 dark:bg-blue-800/10 blur-3xl" />
      <div className="absolute top-[40%] right-[5%] w-56 h-56 rounded-full
                       bg-indigo-200/20 dark:bg-indigo-800/8 blur-3xl" />
      <div className="absolute bottom-[15%] left-[20%] w-48 h-48 rounded-full
                       bg-blue-100/25 dark:bg-blue-900/8 blur-3xl" />

      {/* Circuit lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.06] dark:opacity-[0.04]">
        <line x1="15%" y1="0" x2="15%" y2="100%" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 12"
          className="text-blue-400 dark:text-blue-600" />
        <line x1="45%" y1="0" x2="45%" y2="100%" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 12"
          className="text-indigo-300 dark:text-indigo-700" />
        <line x1="75%" y1="0" x2="75%" y2="100%" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 12"
          className="text-blue-400 dark:text-blue-600" />
        <line x1="0" y1="25%" x2="100%" y2="25%" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 12"
          className="text-blue-300 dark:text-blue-700" />
        <line x1="0" y1="65%" x2="100%" y2="65%" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 12"
          className="text-indigo-300 dark:text-indigo-700" />
        {/* Nodes at intersections */}
        <circle cx="15%" cy="25%" r="3" className="fill-blue-400/40 dark:fill-blue-500/30" />
        <circle cx="45%" cy="65%" r="3" className="fill-indigo-400/40 dark:fill-indigo-500/30" />
        <circle cx="75%" cy="25%" r="2" className="fill-blue-300/50 dark:fill-blue-600/30" />
        <circle cx="45%" cy="25%" r="2" className="fill-blue-400/30 dark:fill-blue-500/20" />
        <circle cx="75%" cy="65%" r="3" className="fill-indigo-300/40 dark:fill-indigo-600/25" />
      </svg>
    </div>
  )
}

export default function Dashboard() {
  const [scans, setScans]     = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const load = () => scansAPI.list()
      .then(r => setScans(r.data))
      .finally(() => setLoading(false))
    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [])

  const running    = scans.filter(s => s.status === "running").length
  const totalVulns = scans.reduce((acc, s) => acc + (s.vulnerabilities?.length || 0), 0)
  const criticals  = scans.filter(s => s.cvss_max >= 9).length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      <GeoBg />
      <Navbar />
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8 animate-fade-in">

        {/* Metrics row */}
        <div className="bg-white/70 dark:bg-dark-800/80 backdrop-blur-sm border border-gray-200 dark:border-dark-600 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <Metric value={scans.length}  label="scans" />
            <Metric value={running}       label="active"          accent="text-blue-500 dark:text-blue-400" />
            <Metric value={totalVulns}    label="vulnerabilities" accent="text-yellow-500 dark:text-yellow-400" />
            <Metric value={criticals}     label="critical"        accent="text-red-500 dark:text-red-400" />
            <button className="bg-blue-600 text-white font-mono font-bold px-6 py-2.5 rounded-lg text-sm
                               hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/25"
              onClick={() => navigate("/scan/new")}>
              + new scan
            </button>
          </div>
          {scans.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-dark-600">
              <SeverityBar scans={scans} />
            </div>
          )}
        </div>

        {/* Scans table */}
        <div className="bg-white/70 dark:bg-dark-800/80 backdrop-blur-sm border border-gray-200 dark:border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-dark-600 flex items-center justify-between">
            <span className="font-mono text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Recent scans</span>
            {running > 0 && (
              <span className="text-xs font-mono text-blue-500 dark:text-blue-400 animate-pulse-slow">
                ● {running} active
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center font-mono text-gray-400 text-sm">loading...</div>
          ) : scans.length === 0 ? (
            <div className="p-16 text-center">
              <img src={logoImg} alt="" className="w-16 h-16 object-contain mx-auto mb-4 opacity-30" />
              <p className="font-mono text-gray-500 text-sm mb-1">No scans yet</p>
              <p className="font-mono text-gray-400 text-xs mb-6">Launch your first autonomous pentest</p>
              <button className="bg-blue-600 text-white font-mono font-bold px-6 py-2.5 rounded-lg text-sm
                                 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/25"
                onClick={() => navigate("/scan/new")}>
                start scanning →
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-dark-600">
                  {["id","target","agent","model","status","vulns","cvss","time"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-mono text-gray-400 dark:text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scans.slice().reverse().map(scan => (
                  <tr key={scan.scan_id}
                    className="border-b border-gray-50 dark:border-dark-700/50 hover:bg-blue-50/50 dark:hover:bg-dark-700/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/scan/${scan.scan_id}`)}>
                    <td className="px-5 py-3 font-mono text-blue-500 dark:text-blue-400 text-xs">{scan.scan_id?.slice(0,8)}</td>
                    <td className="px-5 py-3 font-mono text-gray-700 dark:text-gray-300 text-xs max-w-[180px] truncate">{scan.target}</td>
                    <td className="px-5 py-3 font-mono text-gray-400 dark:text-gray-500 text-xs">{scan.agent_type || "auto"}</td>
                    <td className="px-5 py-3 font-mono text-gray-400 dark:text-gray-500 text-xs">{scan.model?.split(":")[0]}</td>
                    <td className="px-5 py-3"><StatusBadge status={scan.status} /></td>
                    <td className="px-5 py-3 font-mono text-xs">
                      <span className={scan.vulnerabilities?.length > 0 ? "text-yellow-500 dark:text-yellow-400" : "text-gray-300 dark:text-gray-600"}>
                        {scan.vulnerabilities?.length || 0}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs">
                      <span className={
                        scan.cvss_max >= 9 ? "text-red-500 dark:text-red-400 font-bold" :
                        scan.cvss_max >= 7 ? "text-orange-500 dark:text-orange-400" :
                        scan.cvss_max >= 4 ? "text-yellow-500 dark:text-yellow-400" :
                        "text-gray-300 dark:text-gray-600"
                      }>
                        {scan.cvss_max?.toFixed(1) || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-gray-400 dark:text-gray-600 text-xs">
                      {new Date(scan.started_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
