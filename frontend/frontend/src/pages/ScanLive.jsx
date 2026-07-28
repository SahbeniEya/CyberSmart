// src/pages/ScanLive.jsx
import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { scansAPI } from "../api"
import Navbar from "../components/Navbar"

function TerminalLine({ step, index }) {
  const colors = {
    nmap:    "text-accent-blue",
    nikto:   "text-accent-yellow",
    sqlmap:  "text-accent-red",
    curl:    "text-gray-400",
    default: "text-accent-green",
  }
  const color = colors[step.tool] || colors.default

  return (
    <div className="mb-4 animate-slide-up">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gray-600 font-mono text-xs">STEP {index + 1}</span>
        <span className={`font-mono text-xs font-bold ${color}`}>[{step.tool}]</span>
        <span className="text-gray-600 font-mono text-xs">
          {new Date(step.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className="font-mono text-xs text-gray-300 mb-1">
        <span className="text-gray-600">$ </span>{step.command}
      </div>
      <div className="font-mono text-xs text-gray-500 pl-2 border-l border-dark-600 whitespace-pre-wrap">
        {step.output?.slice(0, 400)}{step.output?.length > 400 ? "..." : ""}
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
  const wsRef         = useRef(null)

  // Fetch scan data
  useEffect(() => {
    scansAPI.get(id).then(r => { setScan(r.data); setLoading(false) })
      .catch(() => navigate("/"))
  }, [id])

  // WebSocket for live updates
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/${id}`)
    wsRef.current = ws

    ws.onmessage = e => {
      const msg = JSON.parse(e.data)
      if (msg.type === "step" || msg.type === "status" || msg.type === "done") {
        scansAPI.get(id).then(r => setScan(r.data))
      }
    }
    ws.onerror = () => {
      // Fallback: poll every 2s
      const poll = setInterval(() => {
        scansAPI.get(id).then(r => {
          setScan(r.data)
          if (["finished","error"].includes(r.data.status)) clearInterval(poll)
        })
      }, 2000)
    }

    return () => ws.close()
  }, [id])

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [scan?.steps])

  if (loading) return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <span className="font-mono text-gray-600">loading...</span>
    </div>
  )

  const isRunning = scan?.status === "running"

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-8 animate-fade-in">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-mono font-bold text-white">
                <span className="text-accent-green">scan/</span>{scan.scan_id}
              </h1>
              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                isRunning
                  ? "border-blue-800 text-blue-400 bg-blue-900/30 animate-pulse-slow"
                  : scan.status === "finished"
                  ? "border-green-800 text-accent-green bg-green-900/30"
                  : "border-red-800 text-accent-red bg-red-900/30"
              }`}>
                {isRunning ? "● running" : scan.status === "finished" ? "✓ finished" : "✗ error"}
              </span>
            </div>
            <p className="font-mono text-sm text-gray-500">
              target: <span className="text-white">{scan.target}</span>
              <span className="mx-2 text-dark-600">·</span>
              model: <span className="text-white">{scan.model?.split(":")[0]}</span>
              <span className="mx-2 text-dark-600">·</span>
              steps: <span className="text-white">{scan.steps?.length || 0}</span>
            </p>
          </div>
          <button onClick={() => navigate("/")} className="btn-secondary text-xs">
            ← dashboard
          </button>
        </div>

        <div className="grid grid-cols-3 gap-6">

          {/* Terminal — 2/3 width */}
          <div className="col-span-2">
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-dark-600 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70"/>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70"/>
                  <div className="w-3 h-3 rounded-full bg-green-500/70"/>
                </div>
                <span className="font-mono text-xs text-gray-600 ml-2">agent output</span>
                {isRunning && <span className="ml-auto text-xs font-mono text-accent-green animate-blink">▋</span>}
              </div>
              <div ref={terminalRef} className="terminal rounded-none border-0 min-h-64">
                {scan.steps?.length === 0 && isRunning && (
                  <div className="font-mono text-xs text-gray-600">
                    <span className="text-accent-green">$</span> initializing agent...
                    <span className="animate-blink">▋</span>
                  </div>
                )}
                {scan.steps?.map((step, i) => (
                  <TerminalLine key={i} step={step} index={i} />
                ))}
                {!isRunning && scan.steps?.length > 0 && (
                  <div className="font-mono text-xs text-accent-green mt-4">
                    ✓ scan complete — {scan.steps.length} steps executed
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Findings — 1/3 width */}
          <div className="space-y-4">
            {/* Open ports */}
            <div className="card">
              <h3 className="font-mono text-xs text-gray-400 uppercase mb-3">Open Ports</h3>
              {scan.open_ports?.length > 0 ? (
                <div className="space-y-1">
                  {scan.open_ports.map((p, i) => (
                    <div key={i} className="font-mono text-xs text-accent-green">{p}</div>
                  ))}
                </div>
              ) : (
                <div className="font-mono text-xs text-gray-600">scanning...</div>
              )}
            </div>

            {/* Vulnerabilities */}
            <div className="card">
              <h3 className="font-mono text-xs text-gray-400 uppercase mb-3">Vulnerabilities</h3>
              {scan.vulnerabilities?.length > 0 ? (
                <div className="space-y-1">
                  {scan.vulnerabilities.map((v, i) => (
                    <div key={i} className="font-mono text-xs text-accent-red">{v}</div>
                  ))}
                </div>
              ) : (
                <div className="font-mono text-xs text-gray-600">none detected yet</div>
              )}
            </div>

            {/* CVSS */}
            {scan.cvss_max > 0 && (
              <div className={`card border ${scan.cvss_max >= 9 ? "border-accent-red" : "border-accent-yellow"}`}>
                <h3 className="font-mono text-xs text-gray-400 uppercase mb-2">Max CVSS</h3>
                <div className={`font-mono text-3xl font-bold ${scan.cvss_max >= 9 ? "text-accent-red" : "text-accent-yellow"}`}>
                  {scan.cvss_max.toFixed(1)}
                </div>
                <div className="font-mono text-xs text-gray-600 mt-1">
                  {scan.cvss_max >= 9 ? "🚨 CRITICAL" : scan.cvss_max >= 7 ? "⚠ HIGH" : "INFO"}
                </div>
              </div>
            )}

            {/* Download report */}
            {scan.status === "finished" && (
              <button className="btn-primary w-full text-sm">
                ↓ download report
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
