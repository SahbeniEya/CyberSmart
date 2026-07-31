// src/utils/reportGenerator.js
// Professional multi-page penetration test report generator
// Produces a structured HTML document ready for Print/Save as PDF

export function generateReport(scan) {
  const riskLevel = scan.cvss_max >= 9 ? "CRITICAL" : scan.cvss_max >= 7 ? "HIGH" : scan.cvss_max >= 4 ? "MEDIUM" : "LOW"
  const riskColor = scan.cvss_max >= 9 ? "#ef4444" : scan.cvss_max >= 7 ? "#f97316" : scan.cvss_max >= 4 ? "#eab308" : "#22c55e"

  const critical = scan.vulnerabilities?.filter(v => v.includes("[Critical]")) || []
  const high     = scan.vulnerabilities?.filter(v => v.includes("[High]")) || []
  const medium   = scan.vulnerabilities?.filter(v => v.includes("[Medium]")) || []
  const low      = scan.vulnerabilities?.filter(v => v.includes("[Low]") || v.includes("[Informational]")) || []
  const totalVulns = critical.length + high.length + medium.length + low.length

  const duration = scan.finished_at
    ? Math.round((new Date(scan.finished_at) - new Date(scan.started_at)) / 1000)
    : 0
  const durationStr = duration > 60 ? `${Math.floor(duration/60)}m ${duration%60}s` : `${duration}s`

  // Extract tool names used from steps
  const toolsUsed = [...new Set(scan.steps?.map(s => s.tool) || [])].filter(Boolean)

  // Build findings with structured data
  const buildFindings = (vulns, severity, badgeClass) => {
    return vulns.map(v => {
      const name = v.replace(/\s*\[.*?\]\s*$/, "")
      // Extract proof from scan steps that mention this vuln type
      const keyword = name.split(" ")[0].toLowerCase()
      const proofStep = scan.steps?.find(s =>
        s.output?.toLowerCase().includes(keyword) && s.output?.length > 20
      )
      const proof = proofStep
        ? `$ ${proofStep.command}\n${proofStep.output?.slice(0, 300)}`
        : null

      return { name, severity, badgeClass, proof, tool: proofStep?.tool }
    })
  }

  const findings = [
    ...buildFindings(critical, "Critical", "badge-critical"),
    ...buildFindings(high, "High", "badge-high"),
    ...buildFindings(medium, "Medium", "badge-medium"),
    ...buildFindings(low, "Low", "badge-low"),
  ]

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>CyberSmart — Penetration Test Report — ${scan.target}</title>
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background:#0a0e1a; color:#c9d1d9; font-size:13px; line-height:1.6; }
  .page { max-width:760px; margin:0 auto; padding:40px 0; }
  .page-break { page-break-after: always; }

  /* Cover */
  .cover { min-height:90vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:60px 40px; }
  .cover-logo { font-size:42px; font-weight:800; letter-spacing:-1px; margin-bottom:8px; }
  .cover-logo .c1 { color:#3b82f6; }
  .cover-logo .c2 { color:#e2e8f0; }
  .cover-subtitle { color:#64748b; font-size:14px; font-family:monospace; margin-bottom:48px; }
  .cover-title { font-size:22px; font-weight:300; color:#94a3b8; text-transform:uppercase; letter-spacing:4px; margin-bottom:12px; }
  .cover-target { font-size:28px; font-weight:700; color:#e2e8f0; font-family:monospace; margin-bottom:40px; }
  .cover-meta { display:grid; grid-template-columns:1fr 1fr; gap:16px; text-align:left; width:100%; max-width:400px; }
  .cover-meta-item { border-left:2px solid #1e293b; padding-left:12px; }
  .cover-meta-label { font-size:9px; color:#475569; text-transform:uppercase; letter-spacing:1.5px; font-family:monospace; }
  .cover-meta-value { font-size:14px; color:#e2e8f0; font-family:monospace; margin-top:2px; }
  .cover-footer { margin-top:60px; font-size:10px; color:#334155; font-family:monospace; }
  .cover-badge { display:inline-block; background:${riskColor}22; border:1px solid ${riskColor}44; color:${riskColor}; font-size:11px; font-family:monospace; font-weight:700; padding:4px 16px; border-radius:6px; margin-top:16px; letter-spacing:1px; }
  .confidential { background:#1e293b; color:#64748b; font-size:9px; font-family:monospace; padding:8px 16px; border-radius:4px; margin-top:24px; letter-spacing:2px; text-transform:uppercase; }

  /* Section headers */
  h2 { font-size:16px; font-weight:700; color:#e2e8f0; margin:32px 0 16px; padding-bottom:8px; border-bottom:1px solid #1e293b; }
  h2 .num { color:#3b82f6; margin-right:8px; }
  h3 { font-size:13px; font-weight:600; color:#94a3b8; margin:20px 0 8px; }

  /* Content */
  p { color:#94a3b8; margin-bottom:12px; }
  .card { background:#111827; border:1px solid #1e293b; border-radius:8px; padding:16px; margin-bottom:12px; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px; }
  .stat-label { font-size:9px; color:#475569; text-transform:uppercase; letter-spacing:1.5px; font-family:monospace; }
  .stat-value { font-size:22px; font-weight:700; font-family:monospace; margin-top:2px; }
  .stat-blue { color:#3b82f6; }
  .stat-green { color:#22c55e; }
  .stat-yellow { color:#eab308; }
  .stat-red { color:#ef4444; }

  /* Risk gauge */
  .risk-box { text-align:center; padding:28px; border-radius:12px; margin:20px 0; border:2px solid ${riskColor}; background:${riskColor}08; }
  .risk-score { font-size:56px; font-weight:800; color:${riskColor}; font-family:monospace; }
  .risk-label { font-size:10px; color:#475569; text-transform:uppercase; letter-spacing:2px; font-family:monospace; margin-bottom:4px; }
  .risk-level { font-size:14px; color:${riskColor}; font-weight:700; font-family:monospace; letter-spacing:1px; }

  /* Severity bar */
  .sev-bar { display:flex; height:8px; border-radius:4px; overflow:hidden; margin:12px 0; background:#1e293b; }
  .sev-bar div { height:100%; }
  .sev-legend { display:flex; gap:16px; margin-bottom:16px; }
  .sev-legend span { font-size:11px; font-family:monospace; display:flex; align-items:center; gap:4px; }
  .sev-dot { width:8px; height:8px; border-radius:50%; display:inline-block; }

  /* Findings */
  .finding { background:#111827; border:1px solid #1e293b; border-radius:10px; padding:20px; margin-bottom:16px; page-break-inside:avoid; }
  .finding-header { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
  .finding-title { font-size:14px; font-weight:600; color:#e2e8f0; }
  .badge { font-size:9px; font-weight:700; padding:3px 10px; border-radius:4px; text-transform:uppercase; letter-spacing:0.5px; white-space:nowrap; }
  .badge-critical { background:#7f1d1d; color:#fca5a5; }
  .badge-high { background:#7c2d12; color:#fdba74; }
  .badge-medium { background:#713f12; color:#fde047; }
  .badge-low { background:#1e3a5f; color:#93c5fd; }
  .finding-meta { font-size:10px; color:#475569; font-family:monospace; margin-bottom:8px; }
  .proof { background:#0d1117; border:1px solid #21262d; border-radius:6px; padding:12px; font-family:monospace; font-size:11px; color:#7ee787; white-space:pre-wrap; overflow-x:auto; margin-top:10px; line-height:1.5; }
  .proof-label { font-size:9px; color:#475569; text-transform:uppercase; letter-spacing:1px; font-family:monospace; margin-top:12px; margin-bottom:4px; }

  /* Ports */
  .port-grid { display:flex; flex-wrap:wrap; gap:6px; }
  .port-tag { background:#111827; border:1px solid #1e293b; border-radius:6px; padding:6px 14px; font-family:monospace; font-size:12px; color:#3b82f6; }

  /* Tools */
  .tool-tag { display:inline-block; background:#1e293b; border-radius:4px; padding:3px 10px; font-family:monospace; font-size:11px; color:#94a3b8; margin:2px; }

  /* Methodology */
  .phase { display:flex; gap:12px; margin-bottom:12px; align-items:flex-start; }
  .phase-num { background:#3b82f6; color:#fff; font-size:10px; font-weight:700; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:monospace; flex-shrink:0; margin-top:2px; }
  .phase-title { font-size:13px; font-weight:600; color:#e2e8f0; }
  .phase-desc { font-size:12px; color:#64748b; margin-top:2px; }

  /* Footer */
  .report-footer { text-align:center; padding:24px 0; border-top:1px solid #1e293b; margin-top:32px; }
  .report-footer p { color:#334155; font-size:10px; font-family:monospace; }
  .no-print { margin-top:20px; }
  .print-btn { background:#3b82f6; color:#fff; border:none; padding:14px 40px; border-radius:8px; font-size:14px; cursor:pointer; font-family:monospace; font-weight:700; letter-spacing:0.5px; }
  .print-btn:hover { background:#2563eb; }

  @media print {
    .no-print { display:none; }
    body { background:#fff; color:#1e293b; }
    .cover-logo .c2, .cover-target, .finding-title, .phase-title { color:#111; }
    .cover-subtitle,.cover-meta-label,.stat-label,.risk-label,.finding-meta,.proof-label,.cover-footer,.report-footer p { color:#6b7280; }
    .cover-meta-value,.stat-value { color:#111; }
    p, .phase-desc { color:#374151; }
    h2 { color:#111; border-color:#e5e7eb; }
    .card,.finding,.port-tag,.tool-tag { background:#f9fafb; border-color:#e5e7eb; }
    .proof { background:#f0fdf4; border-color:#dcfce7; color:#166534; }
    .sev-bar { background:#e5e7eb; }
    .cover-meta-item { border-color:#d1d5db; }
    .confidential { background:#f1f5f9; }
  }
</style>
</head><body>
<div class="page">

  <!-- ═══════════ PAGE 1: COVER ═══════════ -->
  <div class="cover">
    <div class="cover-logo"><span class="c1">Cyber</span><span class="c2">Smart</span></div>
    <div class="cover-subtitle">Autonomous Security Platform</div>
    <div class="cover-title">Penetration Testing Report</div>
    <div class="cover-target">${scan.target}</div>
    <div class="cover-badge">${riskLevel} RISK — CVSS ${scan.cvss_max?.toFixed(1) || "0.0"}</div>
    <div class="cover-meta">
      <div class="cover-meta-item"><div class="cover-meta-label">Scan ID</div><div class="cover-meta-value">${scan.scan_id}</div></div>
      <div class="cover-meta-item"><div class="cover-meta-label">Date</div><div class="cover-meta-value">${new Date(scan.started_at).toLocaleDateString()}</div></div>
      <div class="cover-meta-item"><div class="cover-meta-label">Duration</div><div class="cover-meta-value">${durationStr}</div></div>
      <div class="cover-meta-item"><div class="cover-meta-label">Status</div><div class="cover-meta-value">${scan.status}</div></div>
    </div>
    <div class="confidential">Confidential — For Authorized Personnel Only</div>
  </div>
  <div class="page-break"></div>

  <!-- ═══════════ PAGE 2: EXECUTIVE SUMMARY ═══════════ -->
  <h2><span class="num">1.</span> Executive Summary</h2>
  <p>This report documents the results of an automated security assessment performed on <strong>${scan.target}</strong> using the CyberSmart autonomous penetration testing platform. The evaluation was conducted using AI-driven analysis combined with industry-standard security tools to systematically identify potential vulnerabilities.</p>

  <div class="grid-2">
    <div class="card">
      <div class="stat-label">Total Findings</div>
      <div class="stat-value stat-yellow">${totalVulns}</div>
    </div>
    <div class="card">
      <div class="stat-label">Max CVSS Score</div>
      <div class="stat-value" style="color:${riskColor}">${scan.cvss_max?.toFixed(1) || "0.0"}</div>
    </div>
    <div class="card">
      <div class="stat-label">Steps Executed</div>
      <div class="stat-value stat-blue">${scan.steps?.length || 0}</div>
    </div>
    <div class="card">
      <div class="stat-label">Agent Type</div>
      <div class="stat-value stat-green" style="font-size:16px">${scan.agent_type || "auto"}</div>
    </div>
  </div>

  <h3>Severity Distribution</h3>
  <div class="sev-bar">
    ${critical.length > 0 ? `<div style="width:${(critical.length/totalVulns*100)}%;background:#ef4444"></div>` : ""}
    ${high.length > 0 ? `<div style="width:${(high.length/totalVulns*100)}%;background:#f97316"></div>` : ""}
    ${medium.length > 0 ? `<div style="width:${(medium.length/totalVulns*100)}%;background:#eab308"></div>` : ""}
    ${low.length > 0 ? `<div style="width:${(low.length/totalVulns*100)}%;background:#3b82f6"></div>` : ""}
  </div>
  <div class="sev-legend">
    ${critical.length > 0 ? `<span><span class="sev-dot" style="background:#ef4444"></span>${critical.length} Critical</span>` : ""}
    ${high.length > 0 ? `<span><span class="sev-dot" style="background:#f97316"></span>${high.length} High</span>` : ""}
    ${medium.length > 0 ? `<span><span class="sev-dot" style="background:#eab308"></span>${medium.length} Medium</span>` : ""}
    ${low.length > 0 ? `<span><span class="sev-dot" style="background:#3b82f6"></span>${low.length} Low</span>` : ""}
  </div>

  <div class="risk-box">
    <div class="risk-label">Maximum CVSS Score</div>
    <div class="risk-score">${scan.cvss_max?.toFixed(1) || "0.0"}</div>
    <div class="risk-level">${riskLevel}</div>
  </div>
  <div class="page-break"></div>

  <!-- ═══════════ PAGE 3: METHODOLOGY ═══════════ -->
  <h2><span class="num">2.</span> Assessment Methodology</h2>
  <p>This security assessment followed a multi-phase approach combining an autonomous AI agent with specialized security tools. The AI orchestrator analyzed the target context and selected appropriate tools for each testing phase.</p>

  <h3>Testing Phases</h3>
  <div class="phase"><div class="phase-num">1</div><div><div class="phase-title">Reconnaissance & Scanning</div><div class="phase-desc">Automated Python scanner performs HTTP header analysis, technology fingerprinting, and initial vulnerability detection (SQLi, XSS, command injection, LFI, CSRF).</div></div></div>
  <div class="phase"><div class="phase-num">2</div><div><div class="phase-title">Port Discovery & Service Enumeration</div><div class="phase-desc">Nmap full-port scan with service version detection, OS fingerprinting, and vulnerability script execution.</div></div></div>
  <div class="phase"><div class="phase-num">3</div><div><div class="phase-title">Web Application Analysis</div><div class="phase-desc">Nikto web vulnerability scanner for server misconfigurations, default files, outdated software, and known vulnerable scripts.</div></div></div>
  <div class="phase"><div class="phase-num">4</div><div><div class="phase-title">Directory & Content Discovery</div><div class="phase-desc">Gobuster directory and file brute-forcing with curated wordlists to identify hidden endpoints, backup files, and administration interfaces.</div></div></div>
  <div class="phase"><div class="phase-num">5</div><div><div class="phase-title">Input Validation Testing</div><div class="phase-desc">Generic crawling engine discovers pages and forms, then fuzzes all input parameters for SQL injection, cross-site scripting, and file inclusion vulnerabilities.</div></div></div>
  <div class="phase"><div class="phase-num">6</div><div><div class="phase-title">AI-Driven Analysis</div><div class="phase-desc">The LLM agent (${scan.model?.split(":")[0] || "llama3.1"}) analyzes tool outputs, correlates findings, decides next actions, and determines scan completion based on accumulated evidence.</div></div></div>

  <h3>Tools Used</h3>
  <div style="margin-bottom:16px">${toolsUsed.map(t => `<span class="tool-tag">${t}</span>`).join(" ")}</div>
  <div class="page-break"></div>

  <!-- ═══════════ PAGE 4+: SECURITY FINDINGS ═══════════ -->
  <h2><span class="num">3.</span> Security Findings</h2>

  <h3>Findings Summary</h3>
  <div class="card" style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-family:monospace;font-size:12px">
      <tr style="border-bottom:1px solid #1e293b">
        <th style="text-align:left;padding:8px;color:#64748b;font-size:10px;text-transform:uppercase">Finding</th>
        <th style="text-align:left;padding:8px;color:#64748b;font-size:10px;text-transform:uppercase">Severity</th>
      </tr>
      ${findings.map(f => `
        <tr style="border-bottom:1px solid #1e293b20">
          <td style="padding:8px;color:#e2e8f0">${f.name}</td>
          <td style="padding:8px"><span class="badge ${f.badgeClass}">${f.severity}</span></td>
        </tr>
      `).join("")}
    </table>
  </div>

  <h3>Detailed Findings</h3>
  ${findings.map((f, i) => `
    <div class="finding">
      <div class="finding-header">
        <span class="badge ${f.badgeClass}">${f.severity}</span>
        <span class="finding-title">${f.name}</span>
      </div>
      ${f.tool ? `<div class="finding-meta">Detected by: ${f.tool}</div>` : ""}
      ${f.proof ? `
        <div class="proof-label">Evidence</div>
        <div class="proof">${f.proof.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      ` : ""}
    </div>
  `).join("")}

  <!-- ═══════════ OPEN PORTS ═══════════ -->
  ${scan.open_ports?.length > 0 ? `
  <div class="page-break"></div>
  <h2><span class="num">4.</span> Open Ports & Services</h2>
  <p>The following ports were identified as open on the target system during the assessment.</p>
  <div class="port-grid">
    ${scan.open_ports.map(p => `<span class="port-tag">${p}</span>`).join("")}
  </div>
  ` : ""}

  <!-- ═══════════ SCAN LOG ═══════════ -->
  ${scan.steps?.length > 0 ? `
  <div class="page-break"></div>
  <h2><span class="num">${scan.open_ports?.length > 0 ? "5" : "4"}.</span> Scan Execution Log</h2>
  <p>Complete chronological record of all tools executed during the assessment.</p>
  ${scan.steps.map((s, i) => `
    <div class="card" style="margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="color:#3b82f6;font-family:monospace;font-size:11px;font-weight:700">#${i+1}</span>
        <span class="tool-tag">${s.tool}</span>
        <span style="color:#475569;font-family:monospace;font-size:10px;margin-left:auto">${new Date(s.timestamp).toLocaleTimeString()}</span>
      </div>
      <div style="font-family:monospace;font-size:11px;color:#64748b;margin-bottom:4px">$ ${s.command}</div>
      <div class="proof" style="max-height:120px;overflow:auto">${(s.output || "").slice(0, 400).replace(/</g, "&lt;").replace(/>/g, "&gt;")}${s.output?.length > 400 ? "\n..." : ""}</div>
    </div>
  `).join("")}
  ` : ""}

  <!-- ═══════════ FOOTER ═══════════ -->
  <div class="report-footer">
    <p>Generated by CyberSmart Autonomous Security Platform</p>
    <p>${new Date().toLocaleString()} — PFE 2025–2026 · TEK-UP</p>
    <div class="no-print">
      <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
    </div>
  </div>
</div>
</body></html>`

  const w = window.open("", "_blank")
  w.document.write(html)
  w.document.close()
}
