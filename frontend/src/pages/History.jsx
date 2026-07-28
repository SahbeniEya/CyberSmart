import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { scansAPI } from "../api"
import Navbar from "../components/Navbar"

function StatusBadge({ status }) {
  const map    = { running: "badge-running", finished: "badge-finished", error: "badge-error" }
  const labels = { running: "● Running",    finished: "✓ Finished",     error: "✗ Error" }
  return <span className={map[status] || map.error}>{labels[status] || status}</span>
}

export default function History() {
  const [scans,   setScans]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState("all")
  const [search,  setSearch]  = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    scansAPI.list().then(r => setScans(r.data.slice().reverse()))
      .finally(() => setLoading(false))
  }, [])

  const filtered = scans.filter(s => {
    const matchFilter = filter === "all" || s.status === filter
    const matchSearch = s.target?.includes(search) || s.scan_id?.includes(search)
    return matchFilter && matchSearch
  })

  const exportCSV = () => {
    const rows = [["Scan ID","Target","Model","Status","Ports","Vulnerabilities","CVSS Max","Started"]]
    filtered.forEach(s => rows.push([
      s.scan_id, s.target, s.model, s.status,
      s.open_ports?.length, s.vulnerabilities?.length,
      s.cvss_max, s.started_at
    ]))
    const csv = rows.map(r => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a"); a.href = url; a.download = "pentest_history.csv"; a.click()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Scan History</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{filtered.length} scans</p>
          </div>
          <div className="flex gap-3">
            <button onClick={exportCSV} className="btn-secondary text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Export CSV
            </button>
            <button onClick={() => navigate("/scan/new")} className="btn-primary !bg-blue-600 hover:!bg-blue-500 text-sm">
              + New Scan
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-6 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-48">
            <input className="input py-2" placeholder="Search by target or scan ID..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {["all","running","finished","error"].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                  filter === f
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-600"
                }`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-gray-400 text-sm">No scans found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-dark-600 bg-gray-50 dark:bg-dark-700/50">
                  {["Scan ID","Target","Model","Status","Open Ports","Vulns","CVSS Max","Duration","Actions"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-dark-700">
                {filtered.map(scan => {
                  const duration = scan.finished_at
                    ? Math.round((new Date(scan.finished_at) - new Date(scan.started_at)) / 1000) + "s"
                    : "—"

                  return (
                    <tr key={scan.scan_id}
                      className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-blue-600 dark:text-blue-400 font-medium">{scan.scan_id}</td>
                      <td className="px-5 py-3.5 text-gray-900 dark:text-gray-200 text-xs font-medium max-w-32 truncate">{scan.target}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs font-mono">{scan.model?.split(":")[0]}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={scan.status} /></td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 text-xs">{scan.open_ports?.length || 0}</td>
                      <td className="px-5 py-3.5 text-xs">
                        <span className={scan.vulnerabilities?.length > 0 ? "text-yellow-600 dark:text-yellow-400 font-semibold" : "text-gray-400"}>
                          {scan.vulnerabilities?.length || 0}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        <span className={scan.cvss_max >= 9 ? "text-red-600 font-bold" : scan.cvss_max >= 7 ? "text-yellow-600 font-medium" : "text-gray-400"}>
                          {scan.cvss_max > 0 ? scan.cvss_max.toFixed(1) : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs font-mono">{duration}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-2">
                          <button onClick={() => navigate(`/scan/${scan.scan_id}`)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
                            View
                          </button>
                          {scan.status === "finished" && (
                            <button onClick={() => navigate(`/scan/${scan.scan_id}?report=1`)}
                              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:underline">
                              Report
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
