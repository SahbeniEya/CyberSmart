// src/pages/ScanLive.jsx
import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { scansAPI } from "../api"
import Navbar from "../components/Navbar"

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

function generateReport(scan) {
  const riskLevel = scan.cvss_max >= 9 ? "CRITICAL" : scan.cvss_max >= 7 ? "HIGH" : scan.cvss_max >= 4 ? "MEDIUM" : "LOW"
  const riskColor = scan.cvss_max >= 9 ? "#ef4444" : scan.cvss_max >= 7 ? "#f97316" : scan.cvss_max >= 4 ? "#eab308" : "#22c55e"

  const critical = scan.vulnerabilities?.filter(v => v.includes("[Critical]")) || []
  const high     = scan.vulnerabilities?.filter(v => v.includes("[High]")) || []
  const medium   = scan.vulnerabilities?.filter(v => v.includes("[Medium]")) || []
  const low      = scan.vulnerabilities?.filter(v => v.includes("[Low]") || v.includes("[Informational]")) || []

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>CyberSmart — Security Report</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background:#0a0e1a; color:#e2e8f0; padding:40px; }
  .container { max-width:800px; margin:0 auto; }
  .header { text-align:center; padding:40px 0 30px; border-bottom:1px solid #1e293b; margin-bottom:30px; }
  .logo { font-size:28px; font-weight:700; letter-spacing:-0.5px; }
  .logo .cyber { color:#3b82f6; }
  .logo .smart { color:#fff; }
  .subtitle { color:#64748b; font-size:12px; margin-top:6px; font-family:monospace; }
  .meta { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px; }
  .meta-item { background:#111827; border:1px solid #1e293b; border-radius:8px; padding:12px 16px; }
  .meta-label { font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:1px; font-family:monospace; }
  .meta-value { font-size:14px; color:#e2e8f0; margin-top:4px; font-family:monospace; }
  .risk-box { text-align:center; padding:24px; border-radius:12px; margin-bottom:24px; border:2px solid ${riskColor}; background:${riskColor}11; }
  .risk-label { font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:2px; font-family:monospace; }
  .risk-score { font-size:48px; font-weight:700; color:${riskColor}; font-family:monospace; margin:8px 0; }
  .risk-level { font-size:14px; color:${riskColor}; font-weight:600; font-family:monospace; }
  .section { margin-bottom:24px; }
  .section-title { font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:1px; font-family:monospace; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #1e293b; }
  .vuln-item { background:#111827; border:1px solid #1e293b; border-radius:8px; padding:10px 14px; margin-bottom:6px; font-size:13px; font-family:monospace; display:flex; align-items:center; gap:10px; }
  .badge { font-size:9px; font-weight:700; padding:2px 8px; border-radius:4px; text-transform:uppercase; letter-spacing:0.5px; white-space:nowrap; }
  .badge-critical { background:#7f1d1d; color:#fca5a5; }
  .badge-high { background:#7c2d12; color:#fdba74; }
  .badge-medium { background:#713f12; color:#fde047; }
  .badge-low { background:#1e3a5f; color:#93c5fd; }
  .port-grid { display:flex; flex-wrap:wrap; gap:6px; }
  .port-tag { background:#111827; border:1px solid #1e293b; border-radius:6px; padding:6px 12px; font-family:monospace; font-size:12px; color:#3b82f6; }
  .footer { text-align:center; padding:30px 0; border-top:1px solid #1e293b; margin-top:30px; }
  .footer p { color:#475569; font-size:11px; font-family:monospace; }
  .no-print { margin-top:20px; }
  .print-btn { background:#3b82f6; color:#fff; border:none; padding:12px 32px; border-radius:8px; font-size:14px; cursor:pointer; font-family:monospace; font-weight:600; }
  .print-btn:hover { background:#2563eb; }
  @media print { .no-print { display:none; } body { background:#fff; color:#111; } .meta-item,.vuln-item,.port-tag { background:#f8fafc; border-color:#e2e8f0; } .section-title { color:#374151; border-color:#e2e8f0; } .meta-label,.risk-label { color:#6b7280; } .meta-value { color:#111; } .footer p { color:#9ca3af; } }
</style>
</head><body>
<div class="container">
  <div class="header">
    <div class="logo"><span class="cyber">Cyber</span><span class="smart">Smart</span></div>
    <div class="subtitle">Autonomous Security Platform — Penetration Test Report</div>
  </div>

  <div class="meta">
    <div class="meta-item"><div class="meta-label">Scan ID</div><div class="meta-value">${scan.scan_id}</div></div>
    <div class="meta-item"><div class="meta-label">Target</div><div class="meta-value">${scan.target}</div></div>
    <div class="meta-item"><div class="meta-label">Agent</div><div class="meta-value">${scan.agent_type || "auto"}</div></div>
    <div class="meta-item"><div class="meta-label">Model</div><div class="meta-value">${scan.model?.split(":")[0]}</div></div>
    <div class="meta-item"><div class="meta-label">Started</div><div class="meta-value">${new Date(scan.started_at).toLocaleString()}</div></div>
    <div class="meta-item"><div class="meta-label">Duration</div><div class="meta-value">${scan.finished_at ? Math.round((new Date(scan.finished_at) - new Date(scan.started_at)) / 1000) + "s" : "—"}</div></div>
  </div>

  <div class="risk-box">
    <div class="risk-label">Maximum CVSS Score</div>
    <div class="risk-score">${scan.cvss_max?.toFixed(1) || "0.0"}</div>
    <div class="risk-level">${riskLevel} RISK</div>
  </div>

  <div class="section">
    <div class="section-title">Vulnerabilities (${scan.vulnerabilities?.length || 0})</div>
    ${critical.length > 0 ? critical.map(v => `<div class="vuln-item"><span class="badge badge-critical">Critical</span>${v.replace(/\s*\[.*?\]\s*$/, "")}</div>`).join("") : ""}
    ${high.length > 0 ? high.map(v => `<div class="vuln-item"><span class="badge badge-high">High</span>${v.replace(/\s*\[.*?\]\s*$/, "")}</div>`).join("") : ""}
    ${medium.length > 0 ? medium.map(v => `<div class="vuln-item"><span class="badge badge-medium">Medium</span>${v.replace(/\s*\[.*?\]\s*$/, "")}</div>`).join("") : ""}
    ${low.length > 0 ? low.map(v => `<div class="vuln-item"><span class="badge badge-low">Low</span>${v.replace(/\s*\[.*?\]\s*$/, "")}</div>`).join("") : ""}
    ${(scan.vulnerabilities?.length || 0) === 0 ? '<div class="vuln-item" style="color:#64748b">No vulnerabilities detected</div>' : ""}
  </div>

  ${scan.open_ports?.length > 0 ? `
  <div class="section">
    <div class="section-title">Open Ports (${scan.open_ports.length})</div>
    <div class="port-grid">
      ${scan.open_ports.map(p => `<span class="port-tag">${p}</span>`).join("")}
    </div>
  </div>` : ""}

  <div class="footer">
    <p>Generated by CyberSmart — ${new Date().toLocaleString()}</p>
    <p>PFE 2025–2026 · TEK-UP</p>
    <div class="no-print">
      <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
    </div>
  </div>
</div>
</body></html>`

  const w = window.open("", "_blank")
  w.document.write(html)
  w.document.close()
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
