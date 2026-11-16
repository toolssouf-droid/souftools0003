# ==========================================
# SoufTools Production Start Script (PowerShell)
# Builds and starts the production container on port 3000
# ==========================================

Write-Host "⚡ Building and Launching SoufTools Production Suite..." -ForegroundColor Cyan

npm run build
npm run start
