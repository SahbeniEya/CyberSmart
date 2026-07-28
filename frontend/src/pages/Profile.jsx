// src/pages/Profile.jsx
import { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { authAPI } from "../api"
import Navbar from "../components/Navbar"

const API = "http://localhost:8000"

export default function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const [email, setEmail]             = useState("")
  const [currentPwd, setCurrentPwd]   = useState("")
  const [newPwd, setNewPwd]           = useState("")
  const [confirmPwd, setConfirmPwd]   = useState("")

  const [msg, setMsg]     = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    authAPI.me().then(r => {
      setProfile(r.data)
      setEmail(r.data.email)
    }).finally(() => setLoading(false))
  }, [])

  const flash = (m) => { setMsg(m); setError(""); setTimeout(() => setMsg(""), 3000) }
  const flashErr = (m) => { setError(m); setMsg(""); setTimeout(() => setError(""), 5000) }

  const handleUpdateEmail = async () => {
    if (!email.includes("@")) return flashErr("Invalid email")
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API}/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ email })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail) }
      flash("✓ Email updated")
      setProfile(p => ({ ...p, email }))
    } catch (e) { flashErr(e.message) }
  }

  const handleChangePassword = async () => {
    if (!currentPwd) return flashErr("Current password required")
    if (newPwd.length < 6) return flashErr("New password must be at least 6 characters")
    if (newPwd !== confirmPwd) return flashErr("Passwords do not match")
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API}/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ current_password: currentPwd, new_password: newPwd })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail) }
      flash("✓ Password changed")
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("")
    } catch (e) { flashErr(e.message) }
  }

  const ROLE_COLORS = {
    admin:     "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400",
    pentester: "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400",
    devops:    "bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <span className="font-mono text-gray-400 text-sm">Loading...</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-10 animate-fade-in">

        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Profile</h1>

        {msg && (
          <div className="mb-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg px-4 py-2">
            <span className="text-green-700 dark:text-green-400 text-sm font-mono">{msg}</span>
          </div>
        )}
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-4 py-2">
            <span className="text-red-700 dark:text-red-400 text-sm font-mono">✗ {error}</span>
          </div>
        )}

        {/* User info card */}
        <div className="card mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-blue-500/15 border-2 border-blue-500/30 flex items-center justify-center">
              <span className="text-blue-500 dark:text-blue-400 text-xl font-mono font-bold">
                {profile?.username?.[0]?.toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{profile?.username}</p>
              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${ROLE_COLORS[profile?.role] || ""}`}>
                {profile?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="card mb-6">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">Email address</h2>
          <div className="flex gap-2">
            <input className="input flex-1" type="email" value={email}
              onChange={e => setEmail(e.target.value)} />
            <button onClick={handleUpdateEmail}
              className="bg-blue-600 text-white text-xs font-mono font-bold px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors shrink-0">
              Update
            </button>
          </div>
        </div>

        {/* Change password */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">Change password</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-mono text-gray-500 uppercase mb-1">Current password</label>
              <input className="input" type="password" placeholder="••••••••"
                value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-gray-500 uppercase mb-1">New password</label>
              <input className="input" type="password" placeholder="Min 6 characters"
                value={newPwd} onChange={e => setNewPwd(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-gray-500 uppercase mb-1">Confirm new password</label>
              <input className="input" type="password" placeholder="••••••••"
                value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
            </div>
            <button onClick={handleChangePassword}
              className="bg-blue-600 text-white text-xs font-mono font-bold px-6 py-2 rounded-lg hover:bg-blue-500 transition-colors">
              Change password
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
