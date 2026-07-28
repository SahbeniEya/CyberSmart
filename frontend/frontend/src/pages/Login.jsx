// src/pages/Login.jsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function Login() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)
  const { login }    = useAuth()
  const navigate     = useNavigate()

  const handleSubmit = async e => {
    e.preventDefault()
    setError(""); setLoading(true)
    try {
      await login(username, password)
      navigate("/")
    } catch {
      setError("Invalid credentials")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: "linear-gradient(#00ff88 1px,transparent 1px),linear-gradient(90deg,#00ff88 1px,transparent 1px)", backgroundSize: "40px 40px" }} />

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-accent-green rounded flex items-center justify-center">
              <span className="text-dark-900 font-mono font-bold text-sm">P</span>
            </div>
            <span className="font-mono font-bold text-xl text-white tracking-tight">PentestAI</span>
          </div>
          <p className="text-gray-500 text-sm font-mono">Autonomous Security Platform</p>
        </div>

        {/* Card */}
        <div className="card">
          <h1 className="font-mono text-lg font-bold text-white mb-6">
            <span className="text-accent-green">$</span> authenticate
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-gray-400 mb-1.5">USERNAME</label>
              <input
                className="input"
                placeholder="eya"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-gray-400 mb-1.5">PASSWORD</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-accent-red text-xs font-mono flex items-center gap-2">
                <span>✗</span> {error}
              </p>
            )}

            <button className="btn-primary w-full mt-2" disabled={loading}>
              {loading ? "authenticating..." : "→ login"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs font-mono text-dark-600 mt-6">
          PFE 2025-2026 · TEK-UP · SmartSkills
        </p>
      </div>
    </div>
  )
}
