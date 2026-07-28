// src/pages/Dashboard.jsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { scansAPI } from "../api"
import Navbar from "../components/Navbar"

function StatusBadge({ status }) {
  const map = {
    running:  { cls: "badge-running",  label: "● running"  },
    finished: { cls: "badge-finished", label: "✓ finished" },
    error:    { cls: "badge-error",    label: "✗ error"    },
  }
  const { cls, label } = map[status] || map.error
  return <span className={cls}>{label}</span>
}

function StatCard({ label, value, color = "text-white" }) {
  return (
    <div className="card">
      <div className={`text-3xl font-mono font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 font-mono mt-1">{label}</div>
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

  const running  = scans.filter(s => s.status === "running").length
  const finished = scans.filter(s => s.status === "finished").length
  const totalVulns = scans.reduce((acc, s) => acc + (s.vulnerabilities?.length || 0), 0)
  const criticals  = scans.filter(s => s.cvss_max >= 9).length

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-mono font-bold text-white">
              <span className="text-accent-green">~/</span>dashboard
            </h1>
            <p className="text-sm text-gray-500 font-mono mt-1">
              {scans.length} total scans
            </p>
          </div>
          <button className="btn-primary" onClick={() => navigate("/scan/new")}>
            + new scan
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="total scans"    value={scans.length} />
          <StatCard label="running"        value={running}  color="text-accent-blue" />
          <StatCard label="vulnerabilities" value={totalVulns} color="text-accent-yellow" />
          <StatCard label="critical (CVSS≥9)" value={criticals} color="text-accent-red" />
        </div>

        {/* Scans table */}
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-dark-600 flex items-center justify-between">
            <span className="font-mono text-sm text-white">recent scans</span>
            {running > 0 && (
              <span className="text-xs font-mono text-accent-green animate-pulse-slow">
                ● {running} running
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center font-mono text-gray-600 text-sm">loading...</div>
          ) : scans.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-mono text-gray-600 text-sm mb-4">no scans yet</p>
              <button className="btn-primary" onClick={() => navigate("/scan/new")}>
                launch your first scan →
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-600">
                  {["scan id","target","model","status","ports","vulns","started"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-mono text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scans.slice().reverse().map(scan => (
                  <tr key={scan.scan_id}
                    className="border-b border-dark-700 hover:bg-dark-700/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/scan/${scan.scan_id}`)}>
                    <td className="px-5 py-3 font-mono text-accent-green text-xs">{scan.scan_id}</td>
                    <td className="px-5 py-3 font-mono text-gray-300 text-xs">{scan.target}</td>
                    <td className="px-5 py-3 font-mono text-gray-500 text-xs">{scan.model?.split(":")[0]}</td>
                    <td className="px-5 py-3"><StatusBadge status={scan.status} /></td>
                    <td className="px-5 py-3 font-mono text-gray-400 text-xs">{scan.open_ports?.length || 0}</td>
                    <td className="px-5 py-3 font-mono text-xs">
                      <span className={scan.vulnerabilities?.length > 0 ? "text-accent-yellow" : "text-gray-600"}>
                        {scan.vulnerabilities?.length || 0}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-gray-600 text-xs">
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
