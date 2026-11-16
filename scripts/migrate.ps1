# ==========================================
# SoufTools PostgreSQL Migration Script (PowerShell)
# Runs schema synchronization against the configured DATABASE_URL
# ==========================================

Write-Host "🔄 Running SoufTools PostgreSQL Schema Migrations..." -ForegroundColor Cyan

if (-not $env:DATABASE_URL) {
    if (Test-Path ".env.local") {
        Get-Content ".env.local" | ForEach-Object {
            if ($_ -match "DATABASE_URL=(.+)") {
                $env:DATABASE_URL = $matches[1].Trim('"').Trim("'")
            }
        }
    }
}

if (-not $env:DATABASE_URL) {
    Write-Host "⚠️ DATABASE_URL is not set. Migrations will run on server boot via fallback in-memory or connection string." -ForegroundColor Yellow
} else {
    Write-Host "✅ Connected to PostgreSQL target: $($env:DATABASE_URL)" -ForegroundColor Green
}

npx tsx -e "import { runMigrations } from './lib/db/migrate'; runMigrations().then(r => console.log('Migration status:', r));"
