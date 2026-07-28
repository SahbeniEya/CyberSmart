// src/components/Navbar.jsx
import { useAuth } from "../context/AuthContext"
import { useNavigate, Link } from "react-router-dom"

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate("/login") }

  return (
    <nav className="border-b border-dark-600 bg-dark-800/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-6 h-6 bg-accent-green rounded flex items-center justify-center">
            <span className="text-dark-900 font-mono font-bold text-xs">P</span>
          </div>
          <span className="font-mono font-bold text-white text-sm">PentestAI</span>
          <span className="text-dark-600 font-mono text-xs">v1.0</span>
        </Link>

        <div className="flex items-center gap-6">
          <Link to="/" className="text-xs font-mono text-gray-400 hover:text-accent-green transition-colors">
            dashboard
          </Link>
          <Link to="/scan/new" className="text-xs font-mono text-gray-400 hover:text-accent-green transition-colors">
            new scan
          </Link>
          <div className="flex items-center gap-3 border-l border-dark-600 pl-6">
            <span className="text-xs font-mono text-gray-500">{user?.username}</span>
            <button onClick={handleLogout}
              className="text-xs font-mono text-gray-500 hover:text-accent-red transition-colors">
              logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
