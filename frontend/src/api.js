// src/api.js — all backend API calls

import axios from "axios"

const api = axios.create({ baseURL: "http://localhost:8000" })

// Attach JWT token to every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem("token")
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Auto-logout on 401
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token")
      window.location.href = "/login"
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  login:    (username, password) => api.post("/auth/login", { username, password }),
  register: (username, email, password) => api.post("/auth/register", { username, email, password }),
  me:       () => api.get("/auth/me"),
}

export const scansAPI = {
  list:   ()               => api.get("/scans"),
  get:    (id)             => api.get(`/scans/${id}`),
  create: (target, model, max_steps, agent_type = "unknown") =>
    api.post("/scans", { target, model, max_steps, agent_type }),
}

export const adminAPI = {
  listUsers:  ()                       => api.get("/admin/users"),
  createUser: (username, email, password, role) =>
    api.post("/admin/users", { username, email, password, role }),
  updateUser: (username, updates)      => api.put(`/admin/users/${username}`, updates),
  deleteUser: (username)               => api.delete(`/admin/users/${username}`),
}

export const githubAPI = {
  getLink: ()          => api.get("/github/link"),
  setLink: (repo_url)  => api.post("/github/link", { repo_url }),
}

export default api