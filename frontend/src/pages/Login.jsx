// src/pages/Login.jsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import logoImg from "../assets/logo.png"

const API = "http://localhost:8000"

export default function Login() {
  const [mode, setMode] = useState("login") // "login" | "signup"

  // Login fields
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  // Signup fields
  const [regUsername, setRegUsername]   = useState("")
  const [regEmail, setRegEmail]         = useState("")
  const [regPassword, setRegPassword]   = useState("")
  const [regConfirm, setRegConfirm]     = useState("")

  const [error, setError]     = useState("")
  const [loading, setLoading] = useState(false)
  const { login }    = useAuth()
  const navigate     = useNavigate()

  const handleLogin = async e => {
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

  const handleSignup = async e => {
    e.preventDefault()
    setError("")

    if (regPassword !== regConfirm) return setError("Passwords do not match")
    if (regPassword.length < 6) return setError("Password must be at least 6 characters")
    if (regUsername.length < 3) return setError("Username must be at least 3 characters")
    if (!regEmail.includes("@")) return setError("Invalid email address")

    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: regUsername.trim(),
          email:    regEmail.trim(),
          password: regPassword,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Registration failed")

      // Auto-login after registration
      localStorage.setItem("token", data.token)
      localStorage.setItem("user", JSON.stringify({ username: data.username, role: data.role }))
      window.location.href = "/"
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">

        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logoImg} alt="CyberSmart" className="w-16 h-16 object-contain mx-auto mb-3" />
          <h1 className="font-mono font-bold text-xl tracking-tight">
            <span className="text-blue-500 dark:text-blue-400">Cyber</span>
            <span className="text-gray-800 dark:text-white">Smart</span>
          </h1>
          <p className="text-gray-400 text-xs font-mono mt-1">Autonomous Security Platform</p>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
          <button
            onClick={() => { setMode("login"); setError("") }}
            className={`flex-1 text-xs font-mono font-medium py-2 rounded-md transition-colors ${
              mode === "login"
                ? "bg-white dark:bg-dark-800 text-gray-800 dark:text-white shadow-sm"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            }`}>
            Sign in
          </button>
          <button
            onClick={() => { setMode("signup"); setError("") }}
            className={`flex-1 text-xs font-mono font-medium py-2 rounded-md transition-colors ${
              mode === "signup"
                ? "bg-white dark:bg-dark-800 text-gray-800 dark:text-white shadow-sm"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            }`}>
            Sign up
          </button>
        </div>

        {/* Card */}
        <div className="card">

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Username</label>
                <input className="input" placeholder="Enter username"
                  value={username} onChange={e => setUsername(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Password</label>
                <input className="input" type="password" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">
                  <span className="text-red-600 dark:text-red-400 text-xs font-mono">✗ {error}</span>
                </div>
              )}

              <button className="w-full bg-blue-600 text-white font-mono font-bold py-2.5 rounded-lg text-sm
                                 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20
                                 disabled:opacity-40" disabled={loading}>
                {loading ? "Authenticating..." : "→ Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Username</label>
                <input className="input" placeholder="Choose a username (min 3 chars)"
                  value={regUsername} onChange={e => setRegUsername(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Email</label>
                <input className="input" type="email" placeholder="you@example.com"
                  value={regEmail} onChange={e => setRegEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Password</label>
                <input className="input" type="password" placeholder="Min 6 characters"
                  value={regPassword} onChange={e => setRegPassword(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Confirm password</label>
                <input className="input" type="password" placeholder="••••••••"
                  value={regConfirm} onChange={e => setRegConfirm(e.target.value)} />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">
                  <span className="text-red-600 dark:text-red-400 text-xs font-mono">✗ {error}</span>
                </div>
              )}

              <button className="w-full bg-blue-600 text-white font-mono font-bold py-2.5 rounded-lg text-sm
                                 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20
                                 disabled:opacity-40" disabled={loading}>
                {loading ? "Creating account..." : "→ Create account"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[10px] font-mono text-gray-300 dark:text-gray-700 mt-6 tracking-wider">
          PFE 2025–2026 · TEK-UP
        </p>
      </div>
    </div>
  )
}
