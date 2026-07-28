// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import Login      from "./pages/Login"
import Dashboard  from "./pages/Dashboard"
import NewScan    from "./pages/NewScan"
import ScanLive   from "./pages/ScanLive"
import History    from "./pages/History"
import AdminUsers from "./pages/AdminUsers"
import DevOps     from "./pages/DevOps"
import Profile    from "./pages/Profile"

function Protected({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function AdminOnly({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== "admin") return <Navigate to="/" replace />
  return children
}

function DevOpsOnly({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== "devops" && user.role !== "admin") return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/scan/new" element={<Protected><NewScan /></Protected>} />
          <Route path="/scan/:id" element={<Protected><ScanLive /></Protected>} />
          <Route path="/history" element={<Protected><History /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/admin/users" element={<AdminOnly><AdminUsers /></AdminOnly>} />
          <Route path="/devops" element={<DevOpsOnly><DevOps /></DevOpsOnly>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
