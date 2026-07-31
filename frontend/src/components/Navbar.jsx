// src/components/Navbar.jsx
import { useState, useRef, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { useNavigate, Link, useLocation } from "react-router-dom"
import logoImg from "../assets/logo.png"

import NotificationBell from "./NotificationBell"

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [showNotifs, setShowNotifs] = useState(false)
  const [showGithub, setShowGithub] = useState(false)
  const [showUser, setShowUser]     = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))
  const [githubUrl, setGithubUrl] = useState("")
  const [githubMsg, setGithubMsg] = useState("")

  const notifRef  = useRef(null)
  const githubRef = useRef(null)
  const userRef   = useRef(null)

  const handleLogout = () => { logout(); navigate("/login") }
  const isActive = (path) => location.pathname === path

  const toggleTheme = () => {
    const html = document.documentElement
    html.classList.toggle("dark")
    const isDark = html.classList.contains("dark")
    setDark(isDark)
    localStorage.setItem("theme", isDark ? "dark" : "light")
  }

  const handleLinkGithub = async () => {
    if (!githubUrl.trim()) return setGithubMsg("✗ URL is required")
    try {
      const token = localStorage.getItem("token")
      await fetch("http://localhost:8000/github/link", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ repo_url: githubUrl.trim() })
      })
      setGithubMsg("✓ Repository linked")
      setTimeout(() => { setShowGithub(false); setGithubMsg("") }, 1500)
    } catch {
      setGithubMsg("✗ Failed to link repository")
    }
  }

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false)
      if (githubRef.current && !githubRef.current.contains(e.target)) setShowGithub(false)
      if (userRef.current && !userRef.current.contains(e.target)) setShowUser(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem("theme")
    if (saved === "light") document.documentElement.classList.remove("dark")
    else document.documentElement.classList.add("dark")
    setDark(document.documentElement.classList.contains("dark"))
  }, [])

  const role = user?.role
  const ROLE_COLORS = {
    admin:     "bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400",
    pentester: "bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
    devops:    "bg-yellow-100 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  }

  return (
    <nav className="border-b border-gray-200 dark:border-dark-600 bg-white/80 dark:bg-dark-800/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">

        <Link to="/" className="flex items-center gap-2.5 group">
          <img src={logoImg} alt="CyberSmart" className="w-8 h-8 object-contain" />
          <span className="font-mono font-bold text-sm tracking-tight">
            <span className="text-blue-500 dark:text-blue-400 group-hover:text-blue-400 dark:group-hover:text-blue-300 transition-colors">Cyber</span>
            <span className="text-gray-800 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-100 transition-colors">Smart</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <Link to="/" className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${isActive("/") ? "text-blue-500 dark:text-blue-400 bg-blue-500/10" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"}`}>Dashboard</Link>
          <Link to="/history" className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${isActive("/history") ? "text-blue-500 dark:text-blue-400 bg-blue-500/10" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"}`}>History</Link>
          {role === "admin" && <Link to="/admin/users" className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${isActive("/admin/users") ? "text-red-500 dark:text-red-400 bg-red-500/10" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"}`}>Users</Link>}
          {(role === "devops" || role === "admin") && <Link to="/devops" className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${isActive("/devops") ? "text-yellow-500 dark:text-yellow-400 bg-yellow-500/10" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"}`}>DevOps</Link>}
          <Link to="/monitoring" className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${isActive("/monitoring") ? "text-green-500 dark:text-green-400 bg-green-500/10" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"}`}>Monitor</Link>
        </div>

        <div className="flex items-center gap-2">

          {(role === "devops" || role === "admin") && (
            <div ref={githubRef} className="relative">
              <button onClick={() => setShowGithub(!showGithub)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              </button>
              {showGithub && (
                <div className="absolute right-0 top-10 w-80 bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-xl shadow-xl p-4 z-50">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white mb-1">Link GitHub Repository</p>
                  <p className="text-xs text-gray-400 mb-3">Connect your platform repo</p>
                  <input className="w-full rounded-lg border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-xs font-mono placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors mb-3" placeholder="https://github.com/user/repo" value={githubUrl} onChange={e => setGithubUrl(e.target.value)} />
                  {githubMsg && <p className={`text-xs mb-2 ${githubMsg.includes("✓") ? "text-green-500" : "text-red-400"}`}>{githubMsg}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => { setShowGithub(false); setGithubMsg("") }} className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-dark-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-dark-600 transition-colors">Cancel</button>
                    <button onClick={handleLinkGithub} className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors font-medium">Link</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <NotificationBell />
          
          <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
            {dark ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            )}
          </button>

          {role !== "devops" && (
            <button onClick={() => navigate("/scan/new")} className="bg-blue-600 text-white text-xs font-mono font-bold px-4 py-1.5 rounded-lg hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20">+ New Scan</button>
          )}

          {/* User menu with dropdown */}
          <div ref={userRef} className="relative border-l border-gray-200 dark:border-dark-600 pl-3 ml-1">
            <button onClick={() => setShowUser(!showUser)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                <span className="text-blue-500 dark:text-blue-400 text-xs font-mono font-bold">{user?.username?.[0]?.toUpperCase()}</span>
              </div>
              <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[role] || ""}`}>{role}</span>
            </button>

            {showUser && (
              <div className="absolute right-0 top-10 w-48 bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-xl shadow-xl py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-100 dark:border-dark-600">
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{user?.username}</p>
                  <p className="text-[10px] font-mono text-gray-400">{role}</p>
                </div>
                <button onClick={() => { setShowUser(false); navigate("/profile") }}
                  className="w-full text-left px-4 py-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-600 transition-colors font-mono">
                  Profile settings
                </button>
                <button onClick={() => { setShowUser(false); handleLogout() }}
                  className="w-full text-left px-4 py-2 text-xs text-red-500 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-dark-600 transition-colors font-mono">
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
