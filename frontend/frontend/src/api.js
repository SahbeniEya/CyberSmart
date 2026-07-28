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
  login: (username, password) =>
    api.post("/auth/login", { username, password }),
}

export const scansAPI = {
  list:   ()               => api.get("/scans"),
  get:    (id)             => api.get(`/scans/${id}`),
  create: (target, model, max_steps) =>
    api.post("/scans", { target, model, max_steps }),
  gate:   (id)             => api.get(`/scans/${id}/gate`),
}

export default api
