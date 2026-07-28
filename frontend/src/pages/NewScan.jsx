import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { scansAPI } from "../api"
import Navbar from "../components/Navbar"

const MODELS = [
  { value: "llama3.1:latest",  label: "llama3.1",      desc: "General purpose · Fast" },
  { value: "qwen2.5:latest",   label: "qwen2.5",       desc: "Code specialist · Precise" },
]

const AGENTS = [
  { value: "unknown", label: "Auto (orchestrateur)", desc: "L'orchestrateur choisit l'agent", full: true },
  { value: "web",     label: "Agent Web",             desc: "Nmap, scanner XSS/SQLi/headers", full: false },
  { value: "ad",      label: "Agent AD",               desc: "Énumération Active Directory",  full: false },
]

const PRESETS = [
  { label: "testphp.vulnweb.com", target: "testphp.vulnweb.com" },
  { label: "DVWA",                target: "localhost"            },
  { label: "Metasploitable",      target: "172.17.0.2"           },
]

export default function NewScan() {
  const [target,     setTarget]     = useState("")
  const [model,      setModel]      = useState("llama3.1:latest")
  const [maxSteps,   setMaxSteps]   = useState(8)
  const [agentType,  setAgentType]  = useState("unknown")
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState("")
  const navigate = useNavigate()

  const handleSubmit = async e => {
    e.preventDefault()
    if (!target.trim()) return setError("Target is required")
    setError(""); setLoading(true)
    try {
      const { data } = await scansAPI.create(
        target.trim(), model, maxSteps, agentType, null
      )
      navigate(`/scan/${data.scan_id}`)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to start scan")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      <Navbar />
      <div className="max-w-xl mx-auto px-6 py-10 animate-fade-in">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">New Scan</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure and launch an autonomous pentest</p>
        </div>

        <div className="card space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Target */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Target</label>
              <input
                className="w-full rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800
                           text-gray-900 dark:text-gray-100 px-4 py-2.5 text-sm
                           placeholder-gray-400 dark:placeholder-gray-600
                           focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500
                           transition-colors"
                placeholder="e.g. testphp.vulnweb.com or 192.168.1.10"
                value={target} onChange={e => setTarget(e.target.value)} autoFocus />
              <div className="flex gap-2 mt-2 flex-wrap">
                {PRESETS.map(p => (
                  <button key={p.target} type="button" onClick={() => setTarget(p.target)}
                    className="text-xs px-3 py-1 rounded-lg border border-gray-200 dark:border-dark-600
                               text-gray-500 dark:text-gray-400
                               hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400
                               transition-colors">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Agent — Auto on top, Web + AD below */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Agent</label>
              <div className="space-y-3">
                {/* Auto (full width) */}
                {AGENTS.filter(a => a.full).map(a => (
                  <button key={a.value} type="button" onClick={() => setAgentType(a.value)}
                    className={`w-full p-3 rounded-xl border text-center transition-all ${
                      agentType === a.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                        : "border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500"
                    }`}>
                    <div className="font-semibold text-sm text-gray-900 dark:text-white">{a.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.desc}</div>
                  </button>
                ))}
                {/* Web + AD side by side */}
                <div className="grid grid-cols-2 gap-3">
                  {AGENTS.filter(a => !a.full).map(a => (
                    <button key={a.value} type="button" onClick={() => setAgentType(a.value)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        agentType === a.value
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                          : "border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500"
                      }`}>
                      <div className="font-semibold text-sm text-gray-900 dark:text-white">{a.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Model */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">AI Model</label>
              <div className="grid grid-cols-2 gap-3">
                {MODELS.map(m => (
                  <button key={m.value} type="button" onClick={() => setModel(m.value)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      model === m.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                        : "border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500"
                    }`}>
                    <div className="font-semibold text-sm text-gray-900 dark:text-white">{m.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Max steps */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Steps — <span className="text-blue-600 dark:text-blue-400 font-semibold">{maxSteps}</span>
              </label>
              <input type="range" min={4} max={15} value={maxSteps}
                onChange={e => setMaxSteps(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer" />
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-600 mt-1">
                <span>4 — Quick</span><span>15 — Thorough</span>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <span>✗</span> {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => navigate("/")} className="btn-secondary">← Back</button>
              <button className="btn-primary flex-1 !bg-blue-600 hover:!bg-blue-500" disabled={loading}>
                {loading ? "Launching..." : "🚀 Launch Pentest"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
