# ==========================================
# SoufTools Local Development Script (PowerShell)
# Starts local environment with PostgreSQL sync & Next.js dev server
# ==========================================

Write-Host "🚀 Starting SoufTools Local Development..." -ForegroundColor Cyan

# 1. Check environment variables
if (-not (Test-Path ".env.local")) {
    if (Test-Path ".env.example") {
        Write-Host "⚠️ .env.local not found. Copying .env.example to .env.local..." -ForegroundColor Yellow
        Copy-Item ".env.example" ".env.local"
    }
}

# 2. Start Dev Server
Write-Host "🌟 Starting Next.js server on http://localhost:3000..." -ForegroundColor Green
npm run dev
