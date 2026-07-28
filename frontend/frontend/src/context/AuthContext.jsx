// src/context/AuthContext.jsx
import { createContext, useContext, useState } from "react"
import { authAPI } from "../api"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("token")
    const username = localStorage.getItem("username")
    return token ? { token, username } : null
  })

  const login = async (username, password) => {
    const { data } = await authAPI.login(username, password)
    localStorage.setItem("token",    data.token)
    localStorage.setItem("username", data.username)
    setUser({ token: data.token, username: data.username, role: data.role })
    return data
  }

  const logout = () => {
    localStorage.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
