// src/pages/ScanLive.jsx
import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { scansAPI } from "../api"
import Navbar from "../components/Navbar"
import { generateReport } from "../utils/reportGenerator"

function TerminalLine({ step, index }) {
  const colors = {
    nmap:         "text-blue-400",
    nikto:        "text-yellow-400",
    "python-scan":"text-cyan-400",
    enum4linux:   "text-purple-400",
    smbclient:    "text-purple-400",
    rpcclient:    "text-purple-400",
    default:      "text-blue-400",
  }
  const color = colors[step.tool] || colors.default

  return (
    <div className="mb-4 animate-slide-up">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gray-600 font-mono text-xs">#{index + 1}</span>
        <span className={`font-mono text-xs font-bold ${color}`}>[{step.tool}]</span>
        <span className="text-gray-600 font-mono text-xs">
          {new Date(step.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className="font-mono text-xs text-gray-300 mb-1">
        <span className="text-gray-600">$ </span>{step.command}
      </div>
      <div className="font-mono text-xs text-gray-500 pl-2 border-l border-dark-600 whitespace-pre-wrap">
        {step.output?.slice(0, 500)}{step.output?.length > 500 ? "..." : ""}
      </div>
    </div>
  )
}


export default function ScanLive() {
  const { id }        = useParams()
  const navigate      = useNavigate()
  const [scan, setScan] = useState(null)
  const [loading, setLoading] = useState(true)
  const terminalRef   = useRef(null)

  useEffect(() => {
    scansAPI.get(id).then(r => { setScan(r.data); setLoading(false) })
      .catch(() => navigate("/"))
  }, [id])

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/${id}`)
    ws.onmessage = () => scansAPI.get(id).then(r => setScan(r.data))
    ws.onerror = () => {
      const poll = setInterval(() => {
        scansAPI.get(id).then(r => {
          setScan(r.data)
          if (["finished","error"].includes(r.data.status)) clearInterval(poll)
        })
      }, 2000)
    }
    return () => ws.close()
  }, [id])

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight
  }, [scan?.steps])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex items-center justify-center">
      <span className="font-mono text-gray-400">loading...</span>
    </div>
  )

  const isRunning = scan?.status === "running"

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-mono font-bold text-gray-900 dark:text-white">
                <span className="text-blue-500 dark:text-blue-400">scan/</span>{scan.scan_id}
              </h1>
              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                isRunning
                  ? "border-blue-300 dark:border-blue-800 text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 animate-pulse-slow"
                  : scan.status === "finished"
                  ? "border-green-300 dark:border-green-800 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30"
                  : "border-red-300 dark:border-red-800 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
              }`}>
                {isRunning ? "● running" : scan.status === "finished" ? "✓ finished" : "✗ error"}
              </span>
            </div>
            <p className="font-mono text-sm text-gray-400 dark:text-gray-500">
              target: <span className="text-gray-800 dark:text-white">{scan.target}</span>
              <span className="mx-2 text-gray-300 dark:text-dark-600">·</span>
              model: <span className="text-gray-800 dark:text-white">{scan.model?.split(":")[0]}</span>
              <span className="mx-2 text-gray-300 dark:text-dark-600">·</span>
              steps: <span className="text-gray-800 dark:text-white">{scan.steps?.length || 0}</span>
            </p>
          </div>
          <button onClick={() => navigate("/")} className="btn-secondary text-xs">
            ← dashboard
          </button>
        </div>

        <div className="grid grid-cols-3 gap-6">

          {/* Terminal */}
          <div className="col-span-2">
            <div className="bg-gray-900 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-600 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 dark:border-dark-600 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70"/>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70"/>
                  <div className="w-3 h-3 rounded-full bg-green-500/70"/>
                </div>
                <span className="font-mono text-xs text-gray-500 ml-2">agent output</span>
                {isRunning && <span className="ml-auto text-xs font-mono text-blue-400 animate-blink">▋</span>}
              </div>
              <div ref={terminalRef} className="p-4 max-h-[600px] overflow-auto">
                {scan.steps?.length === 0 && isRunning && (
                  <div className="font-mono text-xs text-gray-500">
                    <span className="text-blue-400">$</span> initializing agent...
                    <span className="animate-blink">▋</span>
                  </div>
                )}
                {scan.steps?.map((step, i) => (
                  <TerminalLine key={i} step={step} index={i} />
                ))}
                {!isRunning && scan.steps?.length > 0 && (
                  <div className="font-mono text-xs text-green-400 mt-4">
                    ✓ scan complete — {scan.steps.length} steps executed
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Orchestrator decision */}
            {scan.orchestrator_decisions?.length > 0 && (
              <div className="card">
                <h3 className="font-mono text-xs text-gray-400 uppercase mb-2">Orchestrator</h3>
                <p className="font-mono text-xs text-blue-500 dark:text-blue-400 font-bold">
                  → {scan.orchestrator_decisions[0]?.agent}
                </p>
                <p className="font-mono text-[10px] text-gray-500 mt-1">
                  {scan.orchestrator_decisions[0]?.reason}
                </p>
              </div>
            )}

            {/* Open ports */}
            <div className="card">
              <h3 className="font-mono text-xs text-gray-400 uppercase mb-3">Open Ports</h3>
              {scan.open_ports?.length > 0 ? (
                <div className="space-y-1">
                  {scan.open_ports.map((p, i) => (
                    <div key={i} className="font-mono text-xs text-blue-500 dark:text-blue-400">{p}</div>
                  ))}
                </div>
              ) : (
                <div className="font-mono text-xs text-gray-500">
                  {isRunning ? "scanning..." : "none detected"}
                </div>
              )}
            </div>

            {/* Vulnerabilities */}
            <div className="card">
              <h3 className="font-mono text-xs text-gray-400 uppercase mb-3">
                Vulnerabilities ({scan.vulnerabilities?.length || 0})
              </h3>
              {scan.vulnerabilities?.length > 0 ? (
                <div className="space-y-1 max-h-48 overflow-auto">
                  {scan.vulnerabilities.map((v, i) => (
                    <div key={i} className={`font-mono text-xs ${
                      v.includes("[Critical]") ? "text-red-500" :
                      v.includes("[High]")     ? "text-orange-500" :
                      v.includes("[Medium]")   ? "text-yellow-500" :
                      "text-gray-400"
                    }`}>{v}</div>
                  ))}
                </div>
              ) : (
                <div className="font-mono text-xs text-gray-500">
                  {isRunning ? "scanning..." : "none detected"}
                </div>
              )}
            </div>

            {/* CVSS */}
            {scan.cvss_max > 0 && (
              <div className={`card border ${
                scan.cvss_max >= 9 ? "border-red-300 dark:border-red-800" : "border-yellow-300 dark:border-yellow-800"
              }`}>
                <h3 className="font-mono text-xs text-gray-400 uppercase mb-2">Max CVSS</h3>
                <div className={`font-mono text-3xl font-bold ${
                  scan.cvss_max >= 9 ? "text-red-500" : "text-yellow-500"
                }`}>
                  {scan.cvss_max.toFixed(1)}
                </div>
                <div className="font-mono text-xs text-gray-500 mt-1">
                  {scan.cvss_max >= 9 ? "CRITICAL" : scan.cvss_max >= 7 ? "HIGH" : "MEDIUM"}
                </div>
              </div>
            )}

            {/* Report button */}
            {scan.status === "finished" && (
              <button onClick={() => generateReport(scan)}
                className="w-full bg-blue-600 text-white text-sm font-mono font-bold py-2.5 rounded-lg
                           hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20">
                ↓ Generate Report
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
