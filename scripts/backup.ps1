# SoufTools Backup Script (PowerShell for Windows)
param (
    [string]$DestinationDir = ".\backups"
)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "     Starting SoufTools System Backup    " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$targetFolder = Join-Path $DestinationDir "backup_$timestamp"

if (-not (Test-Path $targetFolder)) {
    New-Item -ItemType Directory -Path $targetFolder -Force | Out-Null
}

Write-Host "Creating backup in $targetFolder..." -ForegroundColor Yellow

# 1. Backup Private Storage Objects
if (Test-Path ".souftools_storage") {
    Copy-Item -Path ".souftools_storage" -Destination (Join-Path $targetFolder "storage") -Recurse -Force
    Write-Host "Backed up Private Object Storage files." -ForegroundColor Green
}

# 2. Backup Local Settings and State
if (Test-Path "lib\db") {
    Copy-Item -Path "lib\db" -Destination (Join-Path $targetFolder "db_schemas") -Recurse -Force
    Write-Host "Backed up Database Schemas." -ForegroundColor Green
}

Write-Host "Backup completed successfully at $targetFolder" -ForegroundColor Green
