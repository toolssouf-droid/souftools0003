/**
 * Device and IP Parser Utility for SoufTools
 * 
 * Accurately parses User-Agent headers to extract real phone model names,
 * operating systems, browsers, and real public IP addresses.
 */

export interface ParsedDeviceInfo {
  name: string;
  deviceType: "mobile" | "tablet" | "desktop" | "bot";
  brand: string;
  model: string;
  os: string;
  browser: string;
  ipAddress: string;
}

/**
 * Extracts accurate client IP from request headers
 */
export function extractClientIp(headers: Headers | Record<string, string | string[] | undefined>): string {
  const getHeader = (name: string): string | null => {
    if ("get" in headers && typeof headers.get === "function") {
      return headers.get(name);
    }
    const val = (headers as Record<string, string | string[] | undefined>)[name.toLowerCase()];
    if (Array.isArray(val)) return val[0] || null;
    return typeof val === "string" ? val : null;
  };

  const xForwardedFor = getHeader("x-forwarded-for");
  if (xForwardedFor) {
    const parts = xForwardedFor.split(",");
    const clientIp = parts[0]?.trim();
    if (clientIp && isValidIp(clientIp)) return clientIp;
  }

  const xRealIp = getHeader("x-real-ip");
  if (xRealIp && isValidIp(xRealIp.trim())) return xRealIp.trim();

  const cfConnectingIp = getHeader("cf-connecting-ip");
  if (cfConnectingIp && isValidIp(cfConnectingIp.trim())) return cfConnectingIp.trim();

  const trueClientIp = getHeader("true-client-ip");
  if (trueClientIp && isValidIp(trueClientIp.trim())) return trueClientIp.trim();

  return "127.0.0.1";
}

function isValidIp(ip: string): boolean {
  if (!ip || ip.length < 3) return false;
  // Basic IPv4 / IPv6 validation
  return ip.includes(".") || ip.includes(":");
}

/**
 * Parses a User-Agent string to extract explicit smartphone brand, model, OS and browser
 */
export function parseDeviceDetails(userAgentRaw?: string | null, ipAddress: string = "127.0.0.1"): ParsedDeviceInfo {
  const ua = (userAgentRaw || "").trim();
  if (!ua) {
    return {
      name: "متصفح غير معروف",
      deviceType: "desktop",
      brand: "Unknown",
      model: "Unknown",
      os: "غير معروف",
      browser: "Web Browser",
      ipAddress,
    };
  }

  // --- 1. Detect OS & Specific Phone Models ---
  let os = "نظام غير معروف";
  let brand = "غير محدد";
  let model = "";
  let deviceType: "mobile" | "tablet" | "desktop" | "bot" = "desktop";

  // iPhone / iPad / iPod
  if (/iPhone/i.test(ua)) {
    deviceType = "mobile";
    brand = "Apple";
    os = "iOS";
    
    // Extract iOS version
    const osMatch = ua.match(/OS (\d+[._]\d+)/i);
    const osVer = osMatch ? ` ${osMatch[1].replace("_", ".")}` : "";
    os = `iOS${osVer}`;

    if (/iPhone16/i.test(ua)) model = "iPhone 16";
    else if (/iPhone15/i.test(ua)) model = "iPhone 15";
    else if (/iPhone14/i.test(ua)) model = "iPhone 14";
    else if (/iPhone13/i.test(ua)) model = "iPhone 13";
    else if (/iPhone12/i.test(ua)) model = "iPhone 12";
    else if (/iPhone11/i.test(ua)) model = "iPhone 11";
    else model = "Apple iPhone";
  } else if (/iPad/i.test(ua)) {
    deviceType = "tablet";
    brand = "Apple";
    os = "iPadOS";
    model = "Apple iPad";
  } else if (/Android/i.test(ua)) {
    deviceType = /Mobile/i.test(ua) ? "mobile" : "tablet";
    brand = "Android";
    
    const androidVer = ua.match(/Android\s+([0-9.]+)/i);
    os = androidVer ? `Android ${androidVer[1]}` : "Android";

    // Extract exact Android phone model from user agent string: e.g. "Build/SM-S928B" or "; SM-G998B Build"
    const modelMatch = ua.match(/;\s*([A-Za-z0-9\s\-_+]+)\s+Build/i) || ua.match(/\(([A-Za-z0-9\s\-_+;]+)\)/i);
    
    // Brand detection
    if (/Samsung|SM-|GT-|SCH-|SGH-|SHV-/i.test(ua)) {
      brand = "Samsung";
      const smMatch = ua.match(/(SM-[A-Z0-9]+|GT-[A-Z0-9]+)/i);
      if (smMatch) {
        model = formatSamsungModel(smMatch[1]);
      } else {
        model = "Samsung Galaxy";
      }
    } else if (/Pixel/i.test(ua)) {
      brand = "Google";
      const pixelMatch = ua.match(/Pixel\s+([0-9a-zA-Z\s]+?)(?:Build|\)|;)/i);
      model = pixelMatch ? `Google Pixel ${pixelMatch[1].trim()}` : "Google Pixel";
    } else if (/Xiaomi|Redmi|POCO|Mi\s/i.test(ua)) {
      brand = "Xiaomi";
      const xiaomiMatch = ua.match(/(Redmi[A-Za-z0-9\s_-]+|POCO[A-Za-z0-9\s_-]+|Mi\s+[A-Za-z0-9\s_-]+|2[0-9]{6}[A-Z]+)/i);
      model = xiaomiMatch ? `Xiaomi ${xiaomiMatch[1].trim()}` : "Xiaomi Smartphone";
    } else if (/Huawei|HONOR/i.test(ua)) {
      brand = /HONOR/i.test(ua) ? "HONOR" : "Huawei";
      model = `${brand} Phone`;
    } else if (/OnePlus/i.test(ua)) {
      brand = "OnePlus";
      model = "OnePlus Device";
    } else if (/Oppo|CPH[0-9]+/i.test(ua)) {
      brand = "OPPO";
      model = "OPPO Phone";
    } else if (/Vivo|V2[0-9]{3}/i.test(ua)) {
      brand = "Vivo";
      model = "Vivo Phone";
    } else if (/Realme|RMX[0-9]+/i.test(ua)) {
      brand = "Realme";
      model = "Realme Phone";
    } else if (modelMatch && modelMatch[1]) {
      const candidate = modelMatch[1].split(";").pop()?.trim();
      if (candidate && candidate.length > 2 && candidate.length < 30) {
        model = candidate;
      } else {
        model = "هاتف أندرويد";
      }
    } else {
      model = "هاتف أندرويد";
    }
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    deviceType = "desktop";
    brand = "Apple";
    os = "macOS";
    model = "MacBook / iMac";
  } else if (/Windows NT/i.test(ua)) {
    deviceType = "desktop";
    brand = "PC";
    if (/Windows NT 10.0/i.test(ua)) os = "Windows 10/11";
    else if (/Windows NT 6.3/i.test(ua)) os = "Windows 8.1";
    else if (/Windows NT 6.1/i.test(ua)) os = "Windows 7";
    else os = "Windows";
    model = "كمبيوتر مكتبي (Windows)";
  } else if (/Linux/i.test(ua)) {
    deviceType = "desktop";
    brand = "Linux";
    os = "Linux";
    model = "جهاز بنظام لينكس";
  }

  // --- 2. Detect Browser ---
  let browser = "المتصفح";
  if (/Edg\//i.test(ua)) {
    browser = "Microsoft Edge";
  } else if (/OPR\/|Opera/i.test(ua)) {
    browser = "Opera";
  } else if (/SamsungBrowser/i.test(ua)) {
    browser = "Samsung Internet";
  } else if (/Chrome\//i.test(ua) && !/Chromium|Edg|OPR/i.test(ua)) {
    browser = "Google Chrome";
  } else if (/Safari\//i.test(ua) && !/Chrome|Chromium|Android/i.test(ua)) {
    browser = "Apple Safari";
  } else if (/Firefox\//i.test(ua)) {
    browser = "Mozilla Firefox";
  }

  // Composite friendly name
  const name = model || (deviceType === "mobile" ? "هاتف ذكي" : "كمبيوتر مكتبي");

  return {
    name,
    deviceType,
    brand,
    model: model || name,
    os,
    browser,
    ipAddress,
  };
}

function formatSamsungModel(modelCode: string): string {
  const code = modelCode.toUpperCase();
  if (code.startsWith("SM-S928")) return "Galaxy S24 Ultra";
  if (code.startsWith("SM-S926")) return "Galaxy S24+";
  if (code.startsWith("SM-S921")) return "Galaxy S24";
  if (code.startsWith("SM-S918")) return "Galaxy S23 Ultra";
  if (code.startsWith("SM-S916")) return "Galaxy S23+";
  if (code.startsWith("SM-S911")) return "Galaxy S23";
  if (code.startsWith("SM-S908")) return "Galaxy S22 Ultra";
  if (code.startsWith("SM-G998")) return "Galaxy S21 Ultra";
  if (code.startsWith("SM-F946")) return "Galaxy Z Fold 5";
  if (code.startsWith("SM-F731")) return "Galaxy Z Flip 5";
  if (code.startsWith("SM-A546")) return "Galaxy A54 5G";
  if (code.startsWith("SM-A536")) return "Galaxy A53 5G";
  if (code.startsWith("SM-A346")) return "Galaxy A34 5G";
  return `Samsung Galaxy (${modelCode})`;
}
