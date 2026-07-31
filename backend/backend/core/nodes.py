# core/nodes.py — Agent step functions
# Each function runs one step of a sub-agent, calls LLM, executes tool, extracts findings.

import json
import re
from datetime import datetime
from core.state import PentestState
from core.llm import call_llm
from core.executor import run_tool
from core.scanner import scan_target

# ══════════════════════════════════════════════════════════════════════
# SYSTEM PROMPTS
# ══════════════════════════════════════════════════════════════════════

WEB_SYSTEM_PROMPT = """You are an autonomous web penetration testing AI agent.
You run tools via native Linux commands or Docker. The target is {target}.

IMPORTANT: When target is localhost or 127.0.0.1, use host.docker.internal for Docker commands.

Available tools:
- nmap scan       → nmap -sV -sC --top-ports 200 {target}
- nmap http       → nmap -p 80,443,8080,8443 --script http-headers,http-methods,http-title {target}
- nmap vulns      → nmap --script vuln -p 80,443 {target}
- nikto           → docker run --rm raesene/nikto -h https://{target} -maxtime 60
- gobuster dirs   → gobuster dir -u https://{target} -w /usr/share/wordlists/dirb/common.txt -t 20 --no-error -q --exclude-length 0
- curl headers    → curl -sI https://{target}
- curl robots     → curl -s https://{target}/robots.txt
- sslscan         → sslscan {target}

Attack phases in order:
1. Recon       → nmap scan to discover open ports and services
2. Headers     → curl headers to check security headers and server info
3. Web scan    → nikto for web vulnerability scanning
4. Dirs        → gobuster dirs to find hidden directories and files
5. SSL check   → sslscan if port 443 is open
6. Deep scan   → nmap vulns for vulnerability scripts on discovered ports
7. Finish      → set finished=true when all phases are covered

Rules:
1. Respond with ONLY valid JSON — no markdown, no explanation
2. Format: {{"tool":"nmap","command":"nmap -sV ...","reason":"...","finished":false}}
3. Never repeat a command already done
4. If output contains ERROR or command not found → skip that tool, move to next phase
5. Set finished=true when all phases are covered or max useful info gathered
6. Adapt: if port 443 not open, skip sslscan. If no web server, skip nikto/gobuster."""


NETWORK_SYSTEM_PROMPT = """You are an autonomous network penetration testing AI agent.
You run tools via native Linux commands. The target is {target}.

Available tools:
- nmap discovery  → nmap -sn {target}
- nmap full       → nmap -sV -sC -p- --min-rate 1000 {target}
- nmap udp        → nmap -sU --top-ports 50 {target}
- nmap os         → nmap -O {target}
- nmap vulns      → nmap --script vuln {target}
- sslscan         → sslscan {target}
- curl            → curl -sI http://{target}

Attack phases:
1. Host discovery → nmap discovery
2. Full port scan → nmap full
3. Service vulns  → nmap vulns on open ports
4. SSL/TLS check  → sslscan if 443/8443 open
5. Finish         → set finished=true

Rules:
1. Respond with ONLY valid JSON
2. Format: {{"tool":"nmap","command":"nmap ...","reason":"...","finished":false}}
3. Never repeat a command already done
4. Set finished=true when all phases covered"""


AD_SYSTEM_PROMPT = """You are an autonomous Active Directory penetration testing AI agent.
You run tools via native Linux commands. The target is {target}.

Available tools:
- smbclient shares  → smbclient -L //{target} -N
- rpcclient users   → rpcclient -U "" -N {target} -c "enumdomusers"
- rpcclient groups  → rpcclient -U "" -N {target} -c "enumdomgroups"
- rpcclient info    → rpcclient -U "" -N {target} -c "querydominfo"
- enum4linux full   → enum4linux -a {target}
- nmap smb          → nmap -p 139,445 --script smb-vuln*,smb-enum-shares,smb-enum-users {target}
- nmap ldap         → nmap -p 389,636 --script ldap-rootdse,ldap-search {target}
- nmap kerberos     → nmap -p 88 --script krb5-enum-users {target}
- ldapsearch        → ldapsearch -x -H ldap://{target} -b "" -s base namingContexts

Attack phases:
1. SMB shares     → smbclient to list shares
2. User enum      → rpcclient to enumerate users and groups
3. Full enum      → enum4linux comprehensive enumeration
4. SMB vulns      → nmap smb vulnerability scripts
5. LDAP           → nmap ldap or ldapsearch if port 389 open
6. Kerberos       → nmap kerberos if port 88 open
7. Finish         → set finished=true

Rules:
1. Respond with ONLY valid JSON
2. Format: {{"tool":"smbclient","command":"smbclient ...","reason":"...","finished":false}}
3. Never repeat a command already done
4. Set finished=true when all phases covered"""


# ══════════════════════════════════════════════════════════════════════
# AGENT STEP FUNCTIONS
# ══════════════════════════════════════════════════════════════════════

def web_agent_step(state: PentestState) -> dict:
    """Execute one step of the web pentest agent."""
    target = state["target"]

    # Clean target for tool usage
    clean_target = target.replace("https://", "").replace("http://", "").rstrip("/")
    url_target = target if target.startswith("http") else f"http://{target}"
    https_target = f"https://{clean_target}" if "https" in target else url_target

    # Determine docker target — localhost needs host.docker.internal inside Docker
    docker_target = "host.docker.internal" if target in ("localhost", "127.0.0.1") else target
    nmap_target = target

    # Step 0 — Always run python-scan first automatically
    steps_done = [s["tool"] for s in state["steps"]]
    if "python-scan" not in steps_done:
        print(f"   🔒 Auto-running python-scan on {target}")
        result = scan_target(url_target)
        step = {
            "tool": "python-scan",
            "command": f"python-scan {target}",
            "output": result["output"],
            "timestamp": datetime.now().isoformat(),
        }
        findings = _extract_findings("python-scan", result["output"], state)
        findings["steps"] = [step]
        findings["vulnerabilities"] = result.get("vulns", [])
        findings["cvss_max"] = max(state.get("cvss_max", 0), result.get("cvss_max", 0))
        print(f"   OUTPUT : {result['output'][:200]}...")
        return findings

    # Subsequent steps — LLM decides what to do
    prompt_template = WEB_SYSTEM_PROMPT.replace("{target}", clean_target) \
        .replace("{docker_target}", docker_target) \
        .replace("{nmap_target}", clean_target)

    return _run_agent_step(state, prompt_template)


def network_agent_step(state: PentestState) -> dict:
    """Execute one step of the network pentest agent."""
    target = state["target"]
    prompt = NETWORK_SYSTEM_PROMPT.replace("{target}", target)
    return _run_agent_step(state, prompt)


def ad_agent_step(state: PentestState) -> dict:
    """Execute one step of the AD pentest agent."""
    target = state["target"]
    prompt = AD_SYSTEM_PROMPT.replace("{target}", target)
    return _run_agent_step(state, prompt)


# ══════════════════════════════════════════════════════════════════════
# SHARED AGENT LOGIC
# ══════════════════════════════════════════════════════════════════════

def _run_agent_step(state: PentestState, system_prompt: str) -> dict:
    """Generic agent step: ask LLM → execute tool → extract findings."""
    current_step = state.get("current_step", 0)
    model = state.get("model", "llama3.1:latest")

    # Build context for LLM
    history = ""
    for s in state.get("steps", []):
        history += f"[Step] Tool: {s['tool']} | Command: {s['command']}\n"
        history += f"Output: {s['output'][:300]}\n\n"

    prompt = f"""Current step: {current_step + 1}
Previous actions:
{history if history else 'None yet — this is the first tool to run.'}

Open ports found so far: {state.get('open_ports', [])}
Vulnerabilities found so far: {state.get('vulnerabilities', [])}

What tool should I run next? Respond with ONLY a JSON object."""

    # Call LLM
    raw = call_llm(prompt, system_prompt, model)

    # Parse JSON response
    try:
        # Clean response — strip markdown, fix double braces
        cleaned = raw.strip()
        cleaned = re.sub(r'^```json\s*', '', cleaned)
        cleaned = re.sub(r'\s*```$', '', cleaned)
        cleaned = cleaned.replace("{{", "{").replace("}}", "}")
        # Extract JSON object
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        if start >= 0 and end > start:
            cleaned = cleaned[start:end]
        decision = json.loads(cleaned)
    except json.JSONDecodeError:
        print(f"   ⚠️  JSON parse error. Raw: {raw[:100]}")
        return {
            "current_step": current_step + 1,
            "steps": [{
                "tool": "error",
                "command": "JSON parse failed",
                "output": raw[:300],
                "timestamp": datetime.now().isoformat(),
            }]
        }

    tool = decision.get("tool", "unknown")
    command = decision.get("command", "")
    reason = decision.get("reason", "")
    finished = decision.get("finished", False)

    print(f"   🤖 LLM → tool: {tool} | finished: {finished}")
    print(f"      Reason: {reason}")

    if finished or tool == "none":
        return {
            "current_step": current_step + 1,
            "status": "finished",
            "finished_at": datetime.now().isoformat(),
            "steps": [{
                "tool": "decision",
                "command": "Agent decided to finish",
                "output": reason,
                "timestamp": datetime.now().isoformat(),
            }]
        }

    # Execute the tool
    print(f"   ⚡ Executing: {command[:80]}...")
    output = run_tool(command)
    print(f"   OUTPUT : {output[:200]}...")

    step = {
        "tool": tool,
        "command": command,
        "output": output,
        "timestamp": datetime.now().isoformat(),
    }

    findings = _extract_findings(tool, output, state)
    findings["steps"] = [step]
    findings["current_step"] = current_step + 1
    return findings


# ══════════════════════════════════════════════════════════════════════
# FINDINGS EXTRACTION
# ══════════════════════════════════════════════════════════════════════

def _extract_findings(tool: str, output: str, state: PentestState) -> dict:
    """Extract open ports, services, and vulnerabilities from tool output."""
    open_ports = list(state.get("open_ports", []))
    services = list(state.get("services", []))
    vulns = list(state.get("vulnerabilities", []))
    cvss = state.get("cvss_max", 0.0)

    if not output:
        return {"open_ports": open_ports, "services": services,
                "vulnerabilities": vulns, "cvss_max": cvss}

    out_lower = output.lower()

    # Extract ports from nmap-style output
    for match in re.finditer(r'(\d+)/tcp\s+open\s+(\S+)', output):
        port, service = match.group(1), match.group(2)
        entry = f"{port}/tcp/{service}"
        if entry not in open_ports:
            open_ports.append(entry)
            services.append(f"{port}/{service}")

    for match in re.finditer(r'(\d+)/udp\s+open\s+(\S+)', output):
        port, service = match.group(1), match.group(2)
        entry = f"{port}/udp/{service}"
        if entry not in open_ports:
            open_ports.append(entry)

    # Extract vulnerabilities from various tools
    # Nikto findings — filter out informational noise
    if tool in ("nikto", "docker"):
        nikto_skip = ["retrieved", "uncommon header", "x-served-by", "x-fastly", 
                      "x-github", "x-proxy", "x-timer", "x-origin", "varnish",
                      "see: http", "cdn was identified"]
        for match in re.finditer(r'\+\s+(/\S+.*?)(?:\n|$)', output):
            finding = match.group(1).strip()
            if finding and len(finding) > 10 and finding not in vulns:
                if not any(skip in finding.lower() for skip in nikto_skip):
                    vulns.append(finding)

    # Nmap script findings
    for match in re.finditer(r'\|.*?(CVE-\d{4}-\d+)', output):
        cve = match.group(1)
        if cve not in vulns:
            vulns.append(f"{cve} [High]")
            cvss = max(cvss, 7.5)

    # Nmap vuln script results
    if "VULNERABLE" in output:
        for match in re.finditer(r'(smb-vuln-\S+|http-vuln-\S+)', output):
            vuln_name = match.group(1)
            entry = f"{vuln_name} [High]"
            if entry not in vulns:
                vulns.append(entry)
                cvss = max(cvss, 8.0)

    # Gobuster/ffuf directory findings
    if tool in ("gobuster", "ffuf"):
        for match in re.finditer(r'(/\S+)\s+\(Status:\s*(\d+)', output):
            path, status = match.group(1), match.group(2)
            if status in ("200", "301", "302", "403"):
                entry = f"Directory found: {path} (HTTP {status}) [Informational]"
                if entry not in vulns:
                    vulns.append(entry)

   # SSL/TLS findings from sslscan
    if tool == "sslscan":
        # Check each protocol line individually, not the whole output
        for line in output.split("\n"):
            line_lower = line.lower().strip()
            if "sslv3" in line_lower and "enabled" in line_lower and "disabled" not in line_lower:
                entry = "SSLv3 Enabled [High]"
                if entry not in vulns:
                    vulns.append(entry)
                    cvss = max(cvss, 7.4)
            if "tlsv1.0" in line_lower and "enabled" in line_lower and "disabled" not in line_lower:
                entry = "TLSv1.0 Enabled (Deprecated) [Medium]"
                if entry not in vulns:
                    vulns.append(entry)
                    cvss = max(cvss, 5.3)
            if "rc4" in line_lower and ("accepted" in line_lower or "enabled" in line_lower):
                entry = "Weak Cipher Suite (RC4) [Medium]"
                if entry not in vulns:
                    vulns.append(entry)
                    cvss = max(cvss, 5.3)
        if "expired" in out_lower:
            entry = "SSL Certificate Expired [Medium]"
            if entry not in vulns:
                vulns.append(entry)
                cvss = max(cvss, 5.3)
        if "self-signed" in out_lower or "self signed" in out_lower:
            entry = "Self-Signed SSL Certificate [Low]"
            if entry not in vulns:
                vulns.append(entry)

    # Curl header findings
    if tool == "curl":
        if "x-powered-by" in out_lower:
            match = re.search(r'x-powered-by:\s*(.+)', output, re.IGNORECASE)
            if match:
                entry = f"X-Powered-By Header Exposed ({match.group(1).strip()}) [Low]"
                if entry not in vulns:
                    vulns.append(entry)

    # SMB findings
    if "anonymous login successful" in out_lower:
        entry = "SMB Anonymous Login Accepted [High]"
        if entry not in vulns:
            vulns.append(entry)
            cvss = max(cvss, 7.5)

    # User enumeration
    user_count = len(re.findall(r'user:\[', output))
    if user_count > 0:
        entry = f"User Enumeration via Null Session ({user_count} accounts) [High]"
        if entry not in vulns:
            vulns.append(entry)
            cvss = max(cvss, 7.5)

    return {
        "open_ports": open_ports,
        "services": services,
        "vulnerabilities": vulns,
        "cvss_max": cvss,
    }


# ══════════════════════════════════════════════════════════════════════
# CONTROL FLOW
# ══════════════════════════════════════════════════════════════════════

def should_continue(state: PentestState) -> str:
    """Decide whether to loop the agent or finish."""
    # Finished flag set by agent
    if state.get("status") == "finished":
        return "finish"

    # Max steps reached
    if state.get("current_step", 0) >= state.get("max_steps", 8):
        print(f"   ⚠️  Max steps ({state['max_steps']}) reached.")
        return "finish"

    # Critical vulnerability found
    if state.get("cvss_max", 0) >= 10.0:
        print(f"   🚨 Critical vulnerability found! CVSS {state['cvss_max']} — stopping.")
        return "finish"

    # Error state
    if state.get("status") == "error":
        return "finish"

    return "continue"


def finalize(state: PentestState) -> dict:
    """Final node — deduplicate findings and set final status."""
    # Deduplicate vulnerabilities
    seen = set()
    unique_vulns = []
    for v in state.get("vulnerabilities", []):
        # Normalize for dedup
        key = re.sub(r'\s*\[.*?\]\s*$', '', v).strip().lower()
        if key not in seen:
            seen.add(key)
            unique_vulns.append(v)

    print(f"\n=== SCAN COMPLETE ===")
    print(f"   Steps executed: {state.get('current_step', 0)}")
    print(f"   Open ports    : {state.get('open_ports', [])}")
    print(f"   Vulnerabilities: {unique_vulns}")

    return {
        "status": "finished",
        "vulnerabilities": unique_vulns,
        "finished_at": datetime.now().isoformat(),
    }