# core/nodes.py — LangGraph sub-agent nodes
# Each function = one node in the graph
#
# NOTE: target-type detection now lives in core/orchestrator.py — the
# principal agent. This file only contains the sub-agents it can call:
# web, network, and AD.

import json
import re
from datetime import datetime
from typing import Literal

from core.state import PentestState, StepResult
from core.llm import call_llm
from core.executor import run_tool
from core.scanner import scan_target


# ── Web Agent step ──────────────────────────────────────────────────────

WEB_SYSTEM_PROMPT = """You are an autonomous web penetration testing AI agent.
You run tools via Docker. The target is {target}.

IMPORTANT: When target is localhost or 127.0.0.1, use host.docker.internal instead in Docker commands.

Available Docker commands:
- nmap basic  → docker run --rm instrumentisto/nmap -sV --top-ports 100 {nmap_target}
- nmap http   → docker run --rm instrumentisto/nmap -p 80,443,8080 --script http-headers,http-methods {nmap_target}
- nikto       → docker run --rm raesene/nikto -h http://{docker_target} -maxtime 60

Attack phases in order:
1. Recon   → nmap basic to discover open ports and services
2. Nikto   → full web vulnerability scan with nikto
3. Finish  → set finished=true

Rules:
1. Respond with ONLY valid JSON — no markdown, no explanation
2. Format: {{"tool":"nmap","command":"docker run ...","reason":"...","finished":false}}
3. Never repeat a command already done
4. If output contains ERROR or pull access denied → skip that tool, move to next phase
5. Set finished=true when all phases are covered"""


def web_agent_step(state: PentestState) -> dict:
    """Execute one step of the web pentest agent."""
    target = state["target"]

def web_agent_step(state: PentestState) -> dict:
    """Execute one step of the web pentest agent."""
    target = state["target"]

    # Determine docker target — localhost needs host.docker.internal inside Docker
    docker_target = "host.docker.internal" if target in ("localhost", "127.0.0.1") else target
    nmap_target   = target  # nmap scans localhost directly (not inside Docker network)

    # Step 0 — Always run python-scan first automatically
    steps_done = [s["tool"] for s in state["steps"]]
    if "python-scan" not in steps_done:
        print(f"   🔒 Auto-running python-scan on {target}")
        result = scan_target(f"http://{target}" if not target.startswith("http") else target)
        output = result["output"]

        vulns    = list(state["vulnerabilities"])
        cvss_max = state.get("cvss_max", 0.0)
        for v in result["vulns"]:
            if v not in vulns:
                vulns.append(v)
        cvss_max = max(cvss_max, result["cvss_max"])

        step = {
            "tool":      "python-scan",
            "command":   f"python-scan http://{target}",
            "output":    output,
            "timestamp": datetime.now().isoformat(),
        }
        print(f"   OUTPUT : {output[:200]}...")
        return {
            "steps":           [step],
            "current_step":    state["current_step"] + 1,
            "vulnerabilities": vulns,
            "cvss_max":        cvss_max,
            "open_ports":      list(state["open_ports"]),
            "services":        list(state["services"]),
        }

    # Fill in the prompt template with both target variants
    prompt_template = WEB_SYSTEM_PROMPT.replace("{target}", target) \
                                        .replace("{docker_target}", docker_target) \
                                        .replace("{nmap_target}", nmap_target)
    return _run_agent_step(state, prompt_template, already_formatted=True)


# ── Network Agent step ──────────────────────────────────────────────────

NETWORK_SYSTEM_PROMPT = """You are an autonomous network penetration testing AI agent.
You run ALL tools via Docker.

Available Docker commands:
- nmap full      → docker run --rm instrumentisto/nmap -sV -sC {target}
- nmap udp       → docker run --rm instrumentisto/nmap -sU --top-ports 20 {target}
- nmap os        → docker run --rm instrumentisto/nmap -O {target}
- nmap scripts   → docker run --rm instrumentisto/nmap --script vuln -p 80,443,22,21 {target}
- sslscan        → docker run --rm nablac0d3/sslscan {target}

Attack phases in order:
1. Port scan  → full nmap scan
2. OS detect  → identify OS and versions
3. SSL check  → check SSL/TLS misconfigurations
4. Vuln scan  → nmap vuln scripts
5. Finish     → set finished=true

Rules:
1. Respond with ONLY valid JSON — no markdown, no explanation
2. Format: {{"tool":"nmap","command":"docker run ...","reason":"...","finished":false}}
3. Never repeat a command already done
4. Set finished=true when all phases are covered"""


def network_agent_step(state: PentestState) -> dict:
    """Execute one step of the network pentest agent."""
    return _run_agent_step(state, NETWORK_SYSTEM_PROMPT)


# ── Active Directory Agent step ───────────────────────────────────────────

AD_SYSTEM_PROMPT = """You are an autonomous Active Directory / SMB penetration testing AI agent.
All tools run natively via WSL2 (Ubuntu). Commands are executed with wsl.exe automatically.

Available WSL2 commands (use exactly as shown, replace {target} with the IP):
- enum4linux    → enum4linux -a {target}
- smb shares    → smbclient -L //{target} -N
- smb users     → rpcclient -U "" -N {target} -c "enumdomusers"
- smb groups    → rpcclient -U "" -N {target} -c "enumdomgroups"
- nmap smb      → docker run --rm instrumentisto/nmap -p 139,445 --script smb-vuln* {target}
- nmap ldap     → docker run --rm instrumentisto/nmap -p 389,636 --script ldap* {target}

Attack phases in order:
1. SMB enum    → smbclient -L //{target} -N  (list shares)
2. User enum   → enum4linux -a {target}  (enumerate users, groups, OS info)
3. RPC enum    → rpcclient -U "" -N {target} -c "enumdomusers"  (confirm users via RPC)
4. Vuln check  → nmap smb vulnerability scripts
5. Finish      → set finished=true

Rules:
1. Respond with ONLY valid JSON — no markdown, no explanation
2. Format: {{"tool":"enum4linux","command":"enum4linux -a {target}","reason":"...","finished":false}}
3. For WSL2 tools (enum4linux, smbclient, rpcclient): write the command WITHOUT docker run
4. Never repeat a command already done
5. Set finished=true when all phases are covered"""


def ad_agent_step(state: PentestState) -> dict:
    """Execute one step of the AD pentest agent via WSL2."""
    return _run_agent_step(state, AD_SYSTEM_PROMPT)


# ── Shared step runner ─────────────────────────────────────────────────────

def _run_agent_step(state: PentestState, system_prompt_template: str,
                     already_formatted: bool = False) -> dict:
    """
    Core logic shared by all agents:
    1. Build prompt with current state
    2. Call LLM → get next tool + command
    3. Execute the tool
    4. Update state with result
    """
    target = state["target"]
    system = system_prompt_template if already_formatted else \
             system_prompt_template.replace("{target}", target)

    # Build context from previous steps
    steps_context = ""
    all_tools_used = [s["tool"] for s in state["steps"]]
    for s in state["steps"][-3:]:  # last 3 steps only
        steps_context += f"\n[{s['tool']}] {s['command']}\n→ {s['output'][:200]}\n"

    prompt = f"""Target: {target}

Findings so far:
  Open ports: {state['open_ports'] or 'unknown'}
  Services: {state['services'] or 'unknown'}
  Vulnerabilities: {state['vulnerabilities'] or 'none'}

Last 3 actions:
{steps_context.strip() or 'none yet'}

Tools already used (do not repeat): {all_tools_used}

What is your next action? JSON only."""

    # Call LLM
    response = call_llm(prompt, system=system, model=state.get("model"))

    # Clean response
    response = response.strip()
    if response.startswith("```"):
        response = response.split("```")[1]
        if response.startswith("json"):
            response = response[4:]
    response = response.strip()

    # Fix double braces from qwen2.5
    response = response.replace("{{", "{").replace("}}", "}")
    # Extract JSON if buried in text
    start = response.find("{")
    end   = response.rfind("}") + 1
    if start >= 0 and end > start:
        response = response[start:end]

    try:
        decision = json.loads(response)
    except json.JSONDecodeError:
        print(f"   ⚠️  Invalid JSON: {response[:100]}")
        return {"status": "error", "error": f"Invalid JSON from LLM: {response[:100]}"}

    tool    = decision.get("tool", "unknown")
    command = decision.get("command", "")
    reason  = decision.get("reason", "")
    finished = decision.get("finished", False)

    print(f"   TOOL   : {tool}")
    print(f"   COMMAND: {command}")
    print(f"   REASON : {reason}")

    if finished:
        print("   ✅ Agent decided to finish.")
        return {"status": "finished"}

    # Execute tool
    output = run_tool(command)
    print(f"   OUTPUT : {output[:200]}...")

    # Build step result
    step: StepResult = {
        "tool":      tool,
        "command":   command,
        "output":    output,
        "timestamp": datetime.now().isoformat(),
    }

    # Extract findings
    updates = _extract_findings(tool, output, state)
    updates["steps"] = [step]
    updates["current_step"] = state["current_step"] + 1

    return updates


def _extract_findings(tool: str, output: str, state: PentestState) -> dict:
    """Extract ports, services, and ALL vulnerability types from tool output."""
    ports    = list(state["open_ports"])
    services = list(state["services"])
    vulns    = list(state["vulnerabilities"])
    cvss_max = state.get("cvss_max", 0.0)
    lines    = output.splitlines()

    # ── Nmap: extract open ports ──────────────────────────────────────────
    if "nmap" in tool.lower():
        for line in lines:
            if "open" in line and "/" in line and "tcp" in line.lower():
                parts = line.split()
                if parts:
                    port_proto = parts[0]
                    service    = parts[2] if len(parts) > 2 else ""
                    version    = " ".join(parts[3:]) if len(parts) > 3 else ""
                    entry = f"{port_proto}/{service}"
                    if entry not in ports:
                        ports.append(entry)
                    if version and version not in services:
                        services.append(version)

    # ── Nikto: extract vulnerability findings ────────────────────────────
    if "nikto" in tool.lower():
        nikto_patterns = [
            # Missing security headers
            (r"(?i)X-Frame-Options.*not.*set|no.*anti-clickjack",       "Missing Anti-Clickjacking Header",        "Medium", 5.3),
            (r"(?i)X-Content-Type.*missing|x-content-type-options",     "X-Content-Type-Options Header Missing",   "Low",    3.7),
            (r"(?i)Content-Security-Policy.*not.*set|CSP.*missing",     "Content Security Policy (CSP) Missing",   "Medium", 5.3),
            (r"(?i)X-XSS-Protection.*missing",                          "X-XSS-Protection Header Missing",         "Low",    3.7),
            # Information disclosure
            (r"(?i)X-Powered-By.*header|powered.by",                    "Server Info via X-Powered-By Header",     "Low",    3.7),
            (r"(?i)Server.*header.*version|server.*leaks.*version",     "Server Version Information Leakage",      "Low",    3.7),
            (r"(?i)suspicious.*comment|debug.*comment",                  "Suspicious Comments Disclosure",          "Info",   0.0),
            # XSS
            (r"(?i)XSS|cross.site.scripting|script.*inject",            "Cross-Site Scripting (XSS)",              "High",   7.5),
            (r"(?i)user.controllable.*html|xss.*possible",              "User Controllable HTML (Potential XSS)",  "Info",   0.0),
            # SQLi
            (r"(?i)SQL.*inject|mysql.*error|sql.*syntax",               "SQL Injection",                           "High",   9.8),
            # CSRF
            (r"(?i)CSRF|anti-csrf.*missing|csrf.*token.*missing",       "Absence of Anti-CSRF Tokens",             "Medium", 6.5),
            # Auth
            (r"(?i)authentication.*found|login.*page|auth.*request",    "Authentication Request Identified",        "Info",   0.0),
            # Charset
            (r"(?i)charset.*mismatch|charset.*differ",                   "Charset Mismatch Header vs Meta",         "Info",   0.0),
            # SSTI
            (r"(?i)template.*inject|SSTI",                              "Server Side Template Injection (SSTI)",   "High",   9.0),
        ]
        for pattern, vuln_name, severity, cvss_score in nikto_patterns:
            if re.search(pattern, output):
                if vuln_name not in vulns:
                    vulns.append(f"{vuln_name} [{severity}]")
                    if cvss_score > cvss_max:
                        cvss_max = cvss_score

    # ── Curl headers: check missing security headers ──────────────────────
    if "curl" in tool.lower():
        header_checks = [
            (r"(?i)X-Powered-By:",               "Server Info via X-Powered-By Header [Low]",      3.7),
            (r"(?i)Server:.*[0-9]",              "Server Version Information Leakage [Low]",        3.7),
        ]
        missing_checks = [
            ("x-frame-options",        "Missing Anti-Clickjacking Header [Medium]",    5.3),
            ("content-security-policy","Content Security Policy (CSP) Missing [Medium]", 5.3),
            ("x-content-type-options", "X-Content-Type-Options Header Missing [Low]",  3.7),
        ]
        output_lower = output.lower()
        for pattern, vuln_name, score in header_checks:
            if re.search(pattern, output):
                if vuln_name not in vulns:
                    vulns.append(vuln_name)
                    if score > cvss_max: cvss_max = score
        for header, vuln_name, score in missing_checks:
            if header not in output_lower:
                if vuln_name not in vulns:
                    vulns.append(vuln_name)
                    if score > cvss_max: cvss_max = score

        # SQLi signs from curl
        sqli_signs = ["sql syntax", "mysql_fetch", "you have an error in your sql",
                      "unclosed quotation", "odbc", "jdbc", "ora-", "pg_query"]
        if any(sign in output.lower() for sign in sqli_signs):
            entry = "SQL Injection [High]"
            if entry not in vulns:
                vulns.append(entry)
                if 9.8 > cvss_max: cvss_max = 9.8

        # XSS reflection check
        if "<script>alert(1)</script>" in output or "alert(1)" in output:
            entry = "Reflected Cross-Site Scripting (XSS) [High]"
            if entry not in vulns:
                vulns.append(entry)
                if 7.5 > cvss_max: cvss_max = 7.5

    # ── Sqlmap: extract SQLi findings ─────────────────────────────────────
    if "sqlmap" in tool.lower():
        if re.search(r"(?i)is vulnerable|injectable|sql injection|parameter.*is|Type:", output):
            entry = "SQL Injection [High]"
            if entry not in vulns:
                vulns.append(entry)
                if 9.8 > cvss_max: cvss_max = 9.8
        if re.search(r"(?i)database.*version|current.*user|current.*database", output):
            entry = "SQL Injection - Data Extraction Possible [Critical]"
            if entry not in vulns:
                vulns.append(entry)
                if 9.8 > cvss_max: cvss_max = 9.8

    # ── AD tools: enum4linux / smbclient / rpcclient findings ────────────
    if any(t in tool.lower() for t in ["enum4linux", "smbclient", "rpcclient", "nmb"]):
        # Null session / anonymous access
        if re.search(r"(?i)anonymous login successful|allows sessions using username", output):
            entry = "SMB Null Session / Anonymous Login Allowed [High]"
            if entry not in vulns:
                vulns.append(entry)
                if 7.5 > cvss_max: cvss_max = 7.5

        # User enumeration via RPC
        if re.search(r"user:\[.*\] rid:", output):
            users_found = re.findall(r"user:\[(\w+)\]", output)
            entry = f"SMB User Enumeration via RPC — {len(users_found)} users found [Medium]"
            if not any("SMB User Enumeration" in v for v in vulns):
                vulns.append(entry)
                if 5.3 > cvss_max: cvss_max = 5.3

        # Accessible shares
        if re.search(r"Mapping: OK|Listing: OK", output):
            shares = re.findall(r"//[\d.]+/(\w+)\s+Mapping: OK", output)
            if shares:
                entry = f"SMB Shares Accessible Anonymously: {', '.join(shares)} [High]"
                if not any("SMB Shares Accessible" in v for v in vulns):
                    vulns.append(entry)
                    if 7.5 > cvss_max: cvss_max = 7.5

        # Samba version disclosure
        if re.search(r"(?i)Samba \d+\.\d+", output):
            version = re.search(r"Samba ([\d.]+)", output)
            v_str = version.group(1) if version else "unknown"
            entry = f"Samba Version Disclosure ({v_str}) [Low]"
            if not any("Samba Version" in v for v in vulns):
                vulns.append(entry)
                if 3.7 > cvss_max: cvss_max = 3.7

        # OS info via SMB
        if re.search(r"(?i)os version|platform_id", output):
            entry = "OS Information Disclosure via SMB [Informational]"
            if entry not in vulns:
                vulns.append(entry)

        # Samba ports detected
        for line in lines:
            if "open" in line and "/" in line and ("139" in line or "445" in line):
                parts = line.split()
                if parts and parts[0] not in ports:
                    ports.append(parts[0])

    # ── CVEs anywhere ─────────────────────────────────────────────────────
    cves = re.findall(r"CVE-\d{4}-\d+", output, re.IGNORECASE)
    for cve in cves:
        cve = cve.upper()
        if cve not in vulns:
            vulns.append(cve)
            if 7.0 > cvss_max: cvss_max = 7.0

    return {
        "open_ports":      ports,
        "services":        services,
        "vulnerabilities": vulns,
        "cvss_max":        cvss_max,
    }


# ── Check if agent should continue ────────────────────────────────────────

def should_continue(state: PentestState) -> Literal["continue", "finish"]:
    """
    Conditional edge — LangGraph calls this to decide next node.
    Returns "finish" if:
    - Agent set finished=true
    - Max steps reached
    - Critical error
    - Critical vulnerability found (CVSS >= 9)
    """
    if state["status"] in ("finished", "error"):
        return "finish"
    if state["current_step"] >= state["max_steps"]:
        print(f"   ⚠️  Max steps ({state['max_steps']}) reached.")
        return "finish"
    if state.get("cvss_max", 0) >= 9.0:
        print(f"   🚨 Critical vulnerability found! CVSS {state['cvss_max']} — stopping.")
        return "finish"
    return "continue"


# ── Finalize ───────────────────────────────────────────────────────────

def finalize(state: PentestState) -> dict:
    """Last node — mark scan as done and deduplicate findings."""
    # Normalize + deduplicate vulnerabilities
    # Two vulns are "same" if they share the same base name (ignoring severity suffix)
    seen_bases = set()
    deduped = []
    for v in state["vulnerabilities"]:
        # Extract base name (everything before the last [ bracket)
        base = v.rsplit("[", 1)[0].strip().lower()
        if base not in seen_bases:
            seen_bases.add(base)
            deduped.append(v)

    print("\n=== SCAN COMPLETE ===")
    print(f"   Steps executed: {state['current_step']}")
    print(f"   Open ports    : {state['open_ports']}")
    print(f"   Vulnerabilities: {deduped}")
    return {
        "status":          "finished",
        "vulnerabilities": deduped,
        "finished_at":     datetime.now().isoformat(),
    }