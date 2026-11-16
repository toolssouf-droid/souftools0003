const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const appDir = path.join(__dirname, '..', 'app');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. High-Tech SVG Logo for SoufTools (512x512 viewbox)
const logoSvg = `<svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="128" fill="url(#bg_grad)"/>
  <rect x="16" y="16" width="480" height="480" rx="112" stroke="url(#border_grad)" stroke-width="8" stroke-opacity="0.6"/>
  
  <!-- Cyber Shield Octagon -->
  <path d="M166 64H346L448 166V346L346 448H166L64 346V166L166 64Z" fill="#0b1414" stroke="url(#border_grad)" stroke-width="14"/>
  
  <!-- Grid Lines -->
  <line x1="64" y1="256" x2="448" y2="256" stroke="#00ff88" stroke-width="2" stroke-dasharray="12 12" opacity="0.3"/>
  <line x1="256" y1="64" x2="256" y2="448" stroke="#00ff88" stroke-width="2" stroke-dasharray="12 12" opacity="0.3"/>
  
  <!-- Neural S Circuit Path -->
  <path d="M332.8 153.6C332.8 125.32 309.88 102.4 281.6 102.4H204.8C169.42 102.4 140.8 131.02 140.8 166.4V192C140.8 227.38 169.42 256 204.8 256H307.2C342.58 256 371.2 284.62 371.2 320V345.6C371.2 380.98 342.58 409.6 307.2 409.6H230.4C202.12 409.6 179.2 386.68 179.2 358.4" 
        stroke="url(#core_grad)" stroke-width="48" stroke-linecap="round"/>
        
  <!-- Glowing Nodes -->
  <circle cx="358.4" cy="153.6" r="32" fill="#00ff88"/>
  <circle cx="153.6" cy="358.4" r="32" fill="#0ea5e9"/>
  <circle cx="256" cy="256" r="24" fill="#ffffff"/>
  
  <!-- Defs -->
  <defs>
    <linearGradient id="bg_grad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0d1717"/>
      <stop offset="0.5" stop-color="#0a0f0f"/>
      <stop offset="1" stop-color="#050808"/>
    </linearGradient>
    <linearGradient id="border_grad" x1="64" y1="64" x2="448" y2="448" gradientUnits="userSpaceOnUse">
      <stop stop-color="#00d4aa"/>
      <stop offset="0.5" stop-color="#00ff88"/>
      <stop offset="1" stop-color="#0ea5e9"/>
    </linearGradient>
    <linearGradient id="core_grad" x1="140" y1="102" x2="371" y2="409" gradientUnits="userSpaceOnUse">
      <stop stop-color="#00ff88"/>
      <stop offset="0.5" stop-color="#00d4aa"/>
      <stop offset="1" stop-color="#38ef7d"/>
    </linearGradient>
  </defs>
</svg>`;

// 2. OpenGraph Banner SVG (1200x630)
const ogSvg = `<svg viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="url(#og_bg)"/>
  
  <!-- Subtle Background Grid -->
  <path d="M0 105H1200M0 210H1200M0 315H1200M0 420H1200M0 525H1200" stroke="#00ff88" stroke-width="1" opacity="0.08"/>
  <path d="M200 0V630M400 0V630M600 0V630M800 0V630M1000 0V630" stroke="#00ff88" stroke-width="1" opacity="0.08"/>
  
  <!-- Glowing Aura behind Logo -->
  <circle cx="280" cy="315" r="220" fill="#00d4aa" opacity="0.15"/>
  <circle cx="280" cy="315" r="140" fill="#00ff88" opacity="0.2"/>
  
  <!-- Embedded Logo Shield at x=140, y=175 (280x280) -->
  <g transform="translate(140, 175) scale(0.546875)">
    <rect width="512" height="512" rx="128" fill="#0d1717" stroke="url(#og_border)" stroke-width="12"/>
    <path d="M166 64H346L448 166V346L346 448H166L64 346V166L166 64Z" fill="#0b1414" stroke="url(#og_border)" stroke-width="14"/>
    <path d="M332.8 153.6C332.8 125.32 309.88 102.4 281.6 102.4H204.8C169.42 102.4 140.8 131.02 140.8 166.4V192C140.8 227.38 169.42 256 204.8 256H307.2C342.58 256 371.2 284.62 371.2 320V345.6C371.2 380.98 342.58 409.6 307.2 409.6H230.4C202.12 409.6 179.2 386.68 179.2 358.4" stroke="url(#og_core)" stroke-width="48" stroke-linecap="round"/>
    <circle cx="358.4" cy="153.6" r="32" fill="#00ff88"/>
    <circle cx="153.6" cy="358.4" r="32" fill="#0ea5e9"/>
    <circle cx="256" cy="256" r="24" fill="#ffffff"/>
  </g>
  
  <!-- Text Typography -->
  <text x="460" y="270" fill="#e8f5f5" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="900" letter-spacing="-1.5">SoufTools AI</text>
  <text x="460" y="340" fill="#00d4aa" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="700">المنصة الذكية الشاملة للذكاء الاصطناعي</text>
  <text x="460" y="400" fill="#88b0b0" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="500">نماذج متطورة • دردشة برمجية • توليد صور • بحث حي في الويب</text>

  <defs>
    <linearGradient id="og_bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0a0f0f"/>
      <stop offset="0.6" stop-color="#0d1717"/>
      <stop offset="1" stop-color="#080d0d"/>
    </linearGradient>
    <linearGradient id="og_border" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop stop-color="#00d4aa"/>
      <stop offset="0.5" stop-color="#00ff88"/>
      <stop offset="1" stop-color="#0ea5e9"/>
    </linearGradient>
    <linearGradient id="og_core" x1="140" y1="102" x2="371" y2="409" gradientUnits="userSpaceOnUse">
      <stop stop-color="#00ff88"/>
      <stop offset="0.5" stop-color="#00d4aa"/>
      <stop offset="1" stop-color="#38ef7d"/>
    </linearGradient>
  </defs>
</svg>`;

function buildAssets() {
  console.log('⚡ Generating SoufTools brand favicons and logos...');

  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), logoSvg);
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), logoSvg);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), logoSvg);
  fs.writeFileSync(path.join(publicDir, 'favicon.png'), logoSvg);
  fs.writeFileSync(path.join(publicDir, 'icon.png'), logoSvg);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), logoSvg);
  fs.writeFileSync(path.join(publicDir, 'icon-192x192.png'), logoSvg);
  fs.writeFileSync(path.join(publicDir, 'icon-512x512.png'), logoSvg);
  fs.writeFileSync(path.join(publicDir, 'logo.png'), logoSvg);

  fs.writeFileSync(path.join(appDir, 'favicon.ico'), logoSvg);
  fs.writeFileSync(path.join(appDir, 'icon.png'), logoSvg);

  fs.writeFileSync(path.join(publicDir, 'og-image.svg'), ogSvg);

  const manifest = {
    name: "SoufTools AI Platform",
    short_name: "SoufTools",
    description: "الجيل القادم من نماذج الذكاء الاصطناعي الفائقة بسرعة استجابة عالية ودعم كامل للغة العربية",
    start_url: "/ar",
    display: "standalone",
    background_color: "#0a0f0f",
    theme_color: "#00d4aa",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any maskable"
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any maskable"
      }
    ]
  };

  fs.writeFileSync(
    path.join(publicDir, 'site.webmanifest'),
    JSON.stringify(manifest, null, 2)
  );
  fs.writeFileSync(
    path.join(publicDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('✅ All brand icons and manifest generated!');
}

buildAssets();
