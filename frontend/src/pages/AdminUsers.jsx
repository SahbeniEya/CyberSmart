// src/pages/AdminUsers.jsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { adminAPI } from "../api"
import Navbar from "../components/Navbar"

const ROLES = ["admin", "pentester", "devops"]
const ROLE_COLORS = {
  admin:     "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400",
  pentester: "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400",
  devops:    "bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
}

export default function AdminUsers() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser]     = useState(null)
  const [error, setError]       = useState("")
  const [success, setSuccess]   = useState("")

  // Create form
  const [newUsername, setNewUsername] = useState("")
  const [newEmail, setNewEmail]       = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newRole, setNewRole]         = useState("pentester")

  // Edit form
  const [editEmail, setEditEmail]       = useState("")
  const [editRole, setEditRole]         = useState("")
  const [editPassword, setEditPassword] = useState("")

  useEffect(() => {
    if (user?.role !== "admin") { navigate("/"); return }
    loadUsers()
  }, [])

  const loadUsers = () => {
    adminAPI.listUsers()
      .then(r => setUsers(r.data))
      .finally(() => setLoading(false))
  }

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(""), 3000) }

  const handleCreate = async e => {
    e.preventDefault(); setError("")
    try {
      await adminAPI.createUser(newUsername, newEmail, newPassword, newRole)
      setShowCreate(false); setNewUsername(""); setNewEmail(""); setNewPassword(""); setNewRole("pentester")
      loadUsers(); flash("User created")
    } catch (err) { setError(err.response?.data?.detail || "Failed") }
  }

  const handleEdit = async e => {
    e.preventDefault(); setError("")
    const updates = {}
    if (editEmail) updates.email = editEmail
    if (editRole) updates.role = editRole
    if (editPassword) updates.password = editPassword
    try {
      await adminAPI.updateUser(editUser.username, updates)
      setEditUser(null); loadUsers(); flash("User updated")
    } catch (err) { setError(err.response?.data?.detail || "Failed") }
  }

  const handleDelete = async (username) => {
    if (!confirm(`Delete user "${username}"?`)) return
    try {
      await adminAPI.deleteUser(username)
      loadUsers(); flash("User deleted")
    } catch (err) { setError(err.response?.data?.detail || "Failed") }
  }

  const openEdit = (u) => {
    setEditUser(u); setEditEmail(u.email); setEditRole(u.role); setEditPassword(""); setError("")
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-8 animate-fade-in">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">User Management</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{users.length} users registered</p>
          </div>
          <button onClick={() => { setShowCreate(true); setError("") }}
            className="bg-blue-600 text-white text-xs font-mono font-bold px-4 py-2 rounded-lg
                       hover:bg-blue-500 transition-colors">
            + Create User
          </button>
        </div>

        {success && (
          <div className="mb-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg px-4 py-2">
            <span className="text-green-700 dark:text-green-400 text-sm font-mono">✓ {success}</span>
          </div>
        )}

        {/* Users table */}
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm font-mono">Loading...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-dark-600 bg-gray-50 dark:bg-dark-700/50">
                  {["Username", "Email", "Role", "Created", "Actions"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-mono font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-dark-700">
                {users.map(u => (
                  <tr key={u.username} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-sm font-medium text-gray-900 dark:text-white">{u.username}</td>
                    <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 text-xs font-mono">{u.email}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-mono font-bold uppercase px-2 py-1 rounded-md ${ROLE_COLORS[u.role] || ROLE_COLORS.pentester}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs font-mono">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(u)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-mono">Edit</button>
                        {u.username !== user?.username && (
                          <button onClick={() => handleDelete(u.username)}
                            className="text-xs text-red-500 dark:text-red-400 hover:underline font-mono">Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-600 p-6 w-full max-w-md shadow-xl"
              onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create User</h2>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-mono text-gray-500 uppercase mb-1">Username</label>
                  <input className="input" value={newUsername} onChange={e => setNewUsername(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-gray-500 uppercase mb-1">Email</label>
                  <input className="input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-gray-500 uppercase mb-1">Password</label>
                  <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-gray-500 uppercase mb-1">Role</label>
                  <div className="flex gap-2">
                    {ROLES.map(r => (
                      <button key={r} type="button" onClick={() => setNewRole(r)}
                        className={`flex-1 py-2 rounded-lg text-xs font-mono font-medium border transition-colors ${
                          newRole === r
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "border-gray-200 dark:border-dark-600 text-gray-500"
                        }`}>{r}</button>
                    ))}
                  </div>
                </div>
                {error && <p className="text-xs text-red-500 font-mono">✗ {error}</p>}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="flex-1 bg-blue-600 text-white font-mono font-bold py-2 rounded-lg text-sm hover:bg-blue-500">Create</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editUser && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditUser(null)}>
            <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-600 p-6 w-full max-w-md shadow-xl"
              onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Edit User</h2>
              <p className="text-xs text-gray-400 font-mono mb-4">{editUser.username}</p>
              <form onSubmit={handleEdit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-mono text-gray-500 uppercase mb-1">Email</label>
                  <input className="input" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-gray-500 uppercase mb-1">Role</label>
                  <div className="flex gap-2">
                    {ROLES.map(r => (
                      <button key={r} type="button" onClick={() => setEditRole(r)}
                        className={`flex-1 py-2 rounded-lg text-xs font-mono font-medium border transition-colors ${
                          editRole === r
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "border-gray-200 dark:border-dark-600 text-gray-500"
                        }`}>{r}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-gray-500 uppercase mb-1">New password (leave empty to keep)</label>
                  <input className="input" type="password" placeholder="••••••••" value={editPassword} onChange={e => setEditPassword(e.target.value)} />
                </div>
                {error && <p className="text-xs text-red-500 font-mono">✗ {error}</p>}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setEditUser(null)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="flex-1 bg-blue-600 text-white font-mono font-bold py-2 rounded-lg text-sm hover:bg-blue-500">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
