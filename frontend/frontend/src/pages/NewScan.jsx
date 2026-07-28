// src/pages/NewScan.jsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { scansAPI } from "../api"
import Navbar from "../components/Navbar"

const MODELS = [
  { value: "llama3.1:latest",   label: "llama3.1",       desc: "General purpose · Fast"       },
  { value: "qwen2.5-coder:7b",  label: "qwen2.5-coder",  desc: "Code specialist · More precise" },
]

const PRESETS = [
  { label: "Web App",        target: "testphp.vulnweb.com",  type: "web"     },
  { label: "DVWA",           target: "dvwa.local",           type: "web"     },
  { label: "Metasploitable", target: "172.17.0.2",           type: "network" },
]

export default function NewScan() {
  const [target,   setTarget]   = useState("")
  const [model,    setModel]    = useState("llama3.1:latest")
  const [maxSteps, setMaxSteps] = useState(8)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")
  const navigate = useNavigate()

  const handleSubmit = async e => {
    e.preventDefault()
    if (!target.trim()) return setError("Target is required")
    setError(""); setLoading(true)
    try {
      const { data } = await scansAPI.create(target.trim(), model, maxSteps)
      navigate(`/scan/${data.scan_id}`)
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to start scan")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10 animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-mono font-bold text-white">
            <span className="text-accent-green">~/</span>new-scan
          </h1>
          <p className="text-sm text-gray-500 font-mono mt-1">
            Configure and launch an autonomous pentest
          </p>
        </div>

        <div className="card space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Target */}
            <div>
              <label className="block text-xs font-mono text-gray-400 mb-2">TARGET</label>
              <input
                className="input"
                placeholder="e.g. testphp.vulnweb.com or 192.168.1.10"
                value={target}
                onChange={e => setTarget(e.target.value)}
                autoFocus
              />
              {/* Presets */}
              <div className="flex gap-2 mt-2 flex-wrap">
                {PRESETS.map(p => (
                  <button key={p.target} type="button"
                    onClick={() => setTarget(p.target)}
                    className="text-xs font-mono px-3 py-1 rounded border border-dark-600
                               text-gray-500 hover:border-accent-green hover:text-accent-green transition-colors">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Model selection */}
            <div>
              <label className="block text-xs font-mono text-gray-400 mb-2">AI MODEL</label>
              <div className="grid grid-cols-2 gap-3">
                {MODELS.map(m => (
                  <button key={m.value} type="button"
                    onClick={() => setModel(m.value)}
                    className={`p-4 rounded border text-left transition-all ${
                      model === m.value
                        ? "border-accent-green bg-accent-green/10"
                        : "border-dark-600 hover:border-gray-500"
                    }`}>
                    <div className="font-mono text-sm font-bold text-white">{m.label}</div>
                    <div className="font-mono text-xs text-gray-500 mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Max steps */}
            <div>
              <label className="block text-xs font-mono text-gray-400 mb-2">
                MAX STEPS — <span className="text-accent-green">{maxSteps}</span>
              </label>
              <input type="range" min={4} max={15} value={maxSteps}
                onChange={e => setMaxSteps(Number(e.target.value))}
                className="w-full accent-accent-green cursor-pointer" />
              <div className="flex justify-between text-xs font-mono text-gray-600 mt-1">
                <span>4 (quick)</span><span>15 (thorough)</span>
              </div>
            </div>

            {error && (
              <p className="text-accent-red text-xs font-mono">✗ {error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => navigate("/")} className="btn-secondary">
                ← back
              </button>
              <button className="btn-primary flex-1" disabled={loading}>
                {loading ? "launching..." : "🚀 launch pentest"}
              </button>
            </div>
          </form>
        </div>

        {/* Info box */}
        <div className="mt-6 p-4 border border-dark-600 rounded-lg">
          <p className="text-xs font-mono text-gray-600">
            <span className="text-accent-yellow">⚠</span> Only test authorized targets.
            The agent will autonomously run Nmap, Nikto, SQLMap via Docker containers.
          </p>
        </div>
      </div>
    </div>
  )
}
