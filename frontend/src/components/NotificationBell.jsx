// src/components/NotificationBell.jsx
// Drop-in component for the Navbar notification system

import { useState, useEffect, useRef } from "react"

const API = "http://localhost:8000"

const TYPE_ICONS = {
  scan_started:       { icon: "🚀", color: "text-blue-500" },
  scan_finished:      { icon: "✓",  color: "text-green-500" },
  critical_vuln:      { icon: "🚨", color: "text-red-500" },
  scan_error:         { icon: "✗",  color: "text-red-500" },
  pipeline_triggered: { icon: "▶",  color: "text-blue-500" },
  pipeline_failed:    { icon: "✗",  color: "text-red-500" },
  pipeline_success:   { icon: "✓",  color: "text-green-500" },
}

function timeAgo(dateStr) {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)

  const token = () => localStorage.getItem("token")
  const headers = () => ({ "Authorization": `Bearer ${token()}`, "Content-Type": "application/json" })

  const load = async () => {
    try {
      const r = await fetch(`${API}/notifications`, { headers: headers() })
      if (r.ok) {
        const data = await r.json()
        setNotifications(data.notifications)
        setUnread(data.unread)
      }
    } catch {}
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000) // Poll every 5s
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const markRead = async (id) => {
    await fetch(`${API}/notifications/${id}/read`, { method: "POST", headers: headers() })
    load()
  }

  const markAllRead = async () => {
    await fetch(`${API}/notifications/read-all`, { method: "POST", headers: headers() })
    load()
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 relative">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-mono font-bold rounded-full flex items-center justify-center px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-dark-600 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800 dark:text-white">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead}
                className="text-[10px] font-mono text-blue-500 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs font-mono text-gray-400">No notifications yet</p>
                <p className="text-[10px] font-mono text-gray-500 mt-1">They'll appear when scans run</p>
              </div>
            ) : (
              notifications.map(n => {
                const typeInfo = TYPE_ICONS[n.type] || { icon: "●", color: "text-gray-400" }
                return (
                  <div key={n.id}
                    className={`px-4 py-3 border-b border-gray-50 dark:border-dark-600/50 hover:bg-gray-50 dark:hover:bg-dark-600/30 transition-colors cursor-pointer ${
                      !n.read ? "bg-blue-50/50 dark:bg-blue-500/5" : ""
                    }`}
                    onClick={() => {
                      if (!n.read) markRead(n.id)
                      if (n.scan_id) {
                        window.location.href = `/scan/${n.scan_id}`
                        setOpen(false)
                      }
                    }}>
                    <div className="flex items-start gap-3">
                      <span className={`text-sm mt-0.5 ${typeInfo.color}`}>{typeInfo.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${!n.read ? "text-gray-800 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>
                            {n.title}
                          </span>
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                        </div>
                        <p className="text-[10px] font-mono text-gray-400 mt-0.5 truncate">{n.message}</p>
                        <span className="text-[9px] font-mono text-gray-400 mt-1 block">{timeAgo(n.created_at)}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
