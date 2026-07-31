# <img src="frontend/src/assets/logo.png" width="32" /> CyberSmart

**AI-Powered Autonomous Penetration Testing Platform**

CyberSmart is an autonomous security assessment platform that uses AI agents orchestrated through a LangGraph state machine to perform automated penetration testing. The platform combines a custom Python vulnerability scanner with industry-standard security tools, all driven by locally-hosted LLMs via Ollama.

> **PFE 2025–2026 · TEK-UP University**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Windows Host                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   Frontend    │  │    Ollama    │  │  Docker Desktop   │  │
│  │ React+Tailwind│  │ llama3.1    │  │  WSL2 integration │  │
│  │  :5173       │  │ qwen2.5     │  │                   │  │
│  │              │  │ :11434      │  │                   │  │
│  └──────┬───────┘  └──────┬──────┘  └─────────┬─────────┘  │
│         │                  │                    │            │
│  ┌──────┴──────────────────┴────────────────────┴─────────┐ │
│  │                  WSL2 Ubuntu 24.04                       │ │
│  │  ┌─────────────────────────────────────────────────┐   │ │
│  │  │          FastAPI Backend (:8000)                  │   │ │
│  │  │  ┌───────────┐  ┌────────────┐  ┌────────────┐  │   │ │
│  │  │  │ LangGraph │→│ Web Agent  │  │  AD Agent  │  │   │ │
│  │  │  │Orchestrator│  │nmap,nikto  │  │enum4linux  │  │   │ │
│  │  │  │           │  │gobuster    │  │smbclient   │  │   │ │
│  │  │  │           │  │sslscan,curl│  │rpcclient   │  │   │ │
│  │  │  └───────────┘  └────────────┘  └────────────┘  │   │ │
│  │  │  ┌──────────┐  ┌──────────────────────────────┐  │   │ │
│  │  │  │ SQLite   │  │  Python Scanner (native)     │  │   │ │
│  │  │  │pentest.db│  │  SQLi,XSS,LFI,CSRF,CmdInj   │  │   │ │
│  │  │  └──────────┘  └──────────────────────────────┘  │   │ │
│  │  └─────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Multi-Agent AI Orchestration
- **AI Orchestrator** analyzes targets and routes to the appropriate agent (Web or AD)
- **Web Agent** — automated web vulnerability scanning with 7-phase methodology
- **AD Agent** — Active Directory / SMB enumeration and vulnerability assessment
- Built on **LangGraph StateGraph** with conditional routing and iterative execution loops

### Vulnerability Scanner
- **Phase A (Target-specific):** DVWA deep tests — SQLi, Blind SQLi, XSS (Reflected/Stored/DOM), Command Injection, LFI, File Upload, Brute Force, CSRF, Insecure CAPTCHA
- **Phase B (Generic Crawl & Fuzz):** Breadth-first crawler (30 pages), automatic form discovery, parameter fuzzing for SQLi/XSS/LFI on any target
- Sensitive path detection, technology fingerprinting, HTTP method analysis

### Security Tools
| Tool | Purpose |
|------|---------|
| Nmap | Port scanning, service detection, vulnerability scripts |
| Nikto | Web vulnerability scanning (Docker) |
| Gobuster | Directory and file brute-forcing |
| sslscan | SSL/TLS protocol and cipher analysis |
| curl | Header inspection, endpoint probing |
| enum4linux | SMB/RPC enumeration |
| smbclient | SMB share listing |
| rpcclient | RPC user/group enumeration |

### Local LLM (Ollama)
- **Llama 3.1** — general-purpose reasoning
- **Qwen 2.5** — code-specialized analysis
- Automatic model fallback if selected model is unavailable
- JSON response cleaning pipeline for malformed LLM outputs
- Zero API costs, full data privacy

### Role-Based Access Control
| Role | Scan | Users | DevOps | Monitor |
|------|------|-------|--------|---------|
| **Admin** | ✅ | ✅ CRUD | ✅ | ✅ |
| **Pentester** | ✅ | — | — | ✅ |
| **DevOps** | — | — | ✅ | ✅ |

### CI/CD Integration
- Real GitHub Actions pipeline for the platform itself (lint, build, security audit)
- DevOps dashboard with pipeline status, execution history, logs, manual trigger
- Dependency security scanning with `pip-audit` and `npm audit`

### Professional Reporting
- Multi-page HTML report with Print/Save as PDF
- Cover page, executive summary, 6-phase methodology, severity-rated findings with evidence
- CVSS risk gauge, severity distribution bar, scan execution log

### Real-Time Monitoring
- Platform health dashboard (Backend, Ollama, Docker, WebSocket status)
- Scan duration trends, agent distribution chart
- Live scan feed with progress bars
- System info (OS, CPU, disk, Docker version)

### Notifications
- Real-time notification bell with unread badge
- Scan started/finished/error, critical vulnerability alerts, pipeline events
- Click-to-navigate to scan details

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Tailwind CSS, Vite, Axios, WebSocket |
| **Backend** | FastAPI, Uvicorn, SQLAlchemy, PyJWT |
| **AI Orchestration** | LangGraph, LangChain Core |
| **LLM Runtime** | Ollama (Llama 3.1, Qwen 2.5) |
| **Database** | SQLite |
| **Security Tools** | Nmap, Nikto, Gobuster, sslscan, enum4linux, smbclient, rpcclient |
| **CI/CD** | GitHub Actions |
| **Environment** | WSL2 Ubuntu 24.04, Docker Desktop |

---

## Prerequisites

- **Windows 10/11** with WSL2 Ubuntu 24.04
- **Docker Desktop** with WSL2 integration enabled
- **Ollama** installed on Windows ([ollama.com](https://ollama.com))
- **Node.js 20+** (for frontend)
- **Python 3.12+** (in WSL2)

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/SahbeniEya/CyberSmart.git
cd CyberSmart
```

### 2. Configure Ollama (Windows)

```powershell
# Set Ollama to listen on all interfaces (required for WSL2 access)
[System.Environment]::SetEnvironmentVariable("OLLAMA_HOST", "0.0.0.0:11434", "User")

# Restart Ollama, then pull models
ollama pull llama3.1
ollama pull qwen2.5
```

### 3. Install backend dependencies (WSL2)

```bash
cd backend/backend
pip3 install -r requirements.txt --break-system-packages
pip3 install sqlalchemy --break-system-packages
```

### 4. Install security tools (WSL2)

```bash
sudo apt update
sudo apt install -y nmap samba-common-bin smbclient ldap-utils sslscan gobuster

# enum4linux
git clone https://github.com/portcullislabs/enum4linux.git ~/enum4linux
sudo cp ~/enum4linux/enum4linux.pl /usr/local/bin/enum4linux
sudo chmod +x /usr/local/bin/enum4linux

# Wordlist for Gobuster
sudo mkdir -p /usr/share/wordlists/dirb
sudo wget https://raw.githubusercontent.com/daviddias/node-dirbuster/master/lists/directory-list-2.3-small.txt \
  -O /usr/share/wordlists/dirb/common.txt
```

### 5. Install frontend dependencies (Windows)

```powershell
cd frontend
npm install
```

---

## Running the Platform

### Terminal 1 — Backend (WSL2)

```bash
cd backend/backend
OLLAMA_URL="http://$(ip route show default | awk '{print $3}'):11434" \
  python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 2 — Frontend (Windows)

```powershell
cd frontend
npm run dev
```

---

## Project Structure

```
CyberSmart/
├── .github/
│   └── workflows/
│       └── ci.yml                 # CI/CD pipeline
├── backend/
│   └── backend/
│       ├── main.py                # FastAPI app + all endpoints
│       ├── database.py            # SQLAlchemy models + CRUD
│       ├── monitoring.py          # Platform health metrics
│       ├── notifications.py       # Notification system
│       ├── github_actions.py      # GitHub Actions API client
│       └── core/
│           ├── graph.py           # LangGraph state machine
│           ├── orchestrator.py    # AI orchestrator (routing)
│           ├── nodes.py           # Agent step functions + prompts
│           ├── scanner.py         # Python vulnerability scanner
│           ├── executor.py        # Tool execution (bash/Docker)
│           ├── llm.py             # Ollama LLM caller
│           └── state.py           # Shared PentestState
├── frontend/
│   └── src/
│       ├── App.jsx                # Routes + role guards
│       ├── api.js                 # API client (Axios)
│       ├── components/
│       │   ├── Navbar.jsx         # Navigation + role-based links
│       │   └── NotificationBell.jsx
│       ├── context/
│       │   └── AuthContext.jsx    # Auth state + JWT
│       ├── pages/
│       │   ├── Login.jsx          # Sign in / Sign up
│       │   ├── Dashboard.jsx      # Scan overview + metrics
│       │   ├── NewScan.jsx        # Scan configuration
│       │   ├── ScanLive.jsx       # Real-time scan terminal
│       │   ├── History.jsx        # Scan history + CSV export
│       │   ├── Profile.jsx        # User profile management
│       │   ├── AdminUsers.jsx     # Admin user CRUD
│       │   ├── DevOps.jsx         # CI/CD pipeline dashboard
│       │   └── Monitoring.jsx     # Platform health monitoring
│       ├── utils/
│       │   └── reportGenerator.js # PDF report generation
│       └── assets/
│           └── logo.png
└── README.md
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/auth/login` | Public | Login |
| POST | `/auth/register` | Public | Register new user |
| GET | `/auth/me` | Auth | Current user profile |
| PUT | `/auth/profile` | Auth | Update email/password |

### Scans
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/scans` | Pentester/Admin | Create scan |
| GET | `/scans` | Auth | List all scans |
| GET | `/scans/{id}` | Auth | Get scan details |
| WS | `/ws/{scan_id}` | Auth | Real-time updates |

### Admin
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/admin/users` | Admin | List users |
| POST | `/admin/users` | Admin | Create user |
| PUT | `/admin/users/{username}` | Admin | Update user |
| DELETE | `/admin/users/{username}` | Admin | Delete user |

### DevOps / GitHub
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/github/link` | DevOps/Admin | Link repository |
| GET | `/github/link` | Auth | Get linked repo |
| POST | `/github/token` | DevOps/Admin | Save GitHub token |
| GET | `/github/runs` | DevOps/Admin | Pipeline runs |
| GET | `/github/runs/{id}/jobs` | DevOps/Admin | Run job details |
| GET | `/github/runs/{id}/logs` | DevOps/Admin | Download logs |
| POST | `/github/trigger` | DevOps/Admin | Trigger pipeline |

### Notifications
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/notifications` | Auth | List notifications |
| POST | `/notifications/{id}/read` | Auth | Mark as read |
| POST | `/notifications/read-all` | Auth | Mark all read |

### Monitoring
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/monitoring` | Auth | Platform health |
| GET | `/health` | Public | Health check |


---

## CI/CD Pipeline

The platform includes a GitHub Actions CI/CD pipeline (`.github/workflows/ci.yml`) that runs on every push:

| Job | Description |
|-----|-------------|
| **Backend** | Python lint (flake8) + verify app loads |
| **Frontend** | npm install + production build |
| **Security** | pip-audit + npm audit for dependency vulnerabilities |

The pipeline can also be triggered manually from the DevOps dashboard.

---

## Screenshots

<p align="center">
  <img src="docs\screenshots\monitoring.png" width="500">
</p>
---

## License

This project is developed as a Final Year Project (PFE) at TEK-UP University, 2025–2026.

---

## Authors

- **Eya Sahbeni** — 