$ErrorActionPreference = "Stop"
Write-Host "========================================="
Write-Host " Compilando Aplicativo Executável FAP"
Write-Host "========================================="

$ScriptDir = $PSScriptRoot
$RootDir = Resolve-Path (Join-Path $ScriptDir "..")
$TempBuildDir = Join-Path $ScriptDir "temp_build"

# 1. Preparar Ambiente Isolado (temp_build)
Write-Host "`n[1/4] Preparando Ambiente Isolado..."
if (Test-Path $TempBuildDir) {
    Remove-Item -Recurse -Force $TempBuildDir
}
New-Item -ItemType Directory -Force -Path $TempBuildDir | Out-Null

$ApiSrc = Join-Path $RootDir "slave-estoque-api"
$PwaSrc = Join-Path $RootDir "slave-estoque-pwa"
$ApiDest = Join-Path $TempBuildDir "api"
$PwaDest = Join-Path $TempBuildDir "pwa"

# Copiando arquivos originais excluindo node_modules para não gerar conflito de permissões/arquiteturas na cópia
Write-Host " Copiando API..."
robocopy $ApiSrc $ApiDest /E /XD node_modules .git /XF .env | Out-Null
Write-Host " Copiando PWA..."
robocopy $PwaSrc $PwaDest /E /XD node_modules .git /XF .env | Out-Null
# Ignore error code < 8 for robocopy (1 means files copied successfully)
if ($LASTEXITCODE -ge 8) { throw "Robocopy failed" }

# 2. Build PWA no Ambiente Isolado
Write-Host "`n[2/4] Compilando Frontend (PWA) Isolado..."
Set-Location $PwaDest
npm install --legacy-peer-deps
if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar dependências do PWA" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar o PWA" }

# 3. Preparar API no Ambiente Isolado
Write-Host "`n[3/4] Preparando API e Prisma Isolado..."
Set-Location $ApiDest
npm install
npx prisma generate

# 4. Compilar EXE com Electron Builder
Write-Host "`n[4/4] Compilando arquivo .exe do Painel..."
Set-Location $ScriptDir

# Garantir dependencias do painel (O Electron)
npm install

# Corrigir main no package.json caso esteja incorreto
$pkg = Get-Content package.json | ConvertFrom-Json
$pkg.main = "main.js"
$pkg.scripts = @{
    "start" = "electron ."
    "build" = "electron-builder --config electron-builder.json"
}
$pkg | ConvertTo-Json -Depth 10 | Set-Content package.json

# Executar o build via Electron-Builder
npx electron-builder --config electron-builder.json

Write-Host "`n=========================================" -ForegroundColor Green
Write-Host " SUCESSO! O arquivo .exe foi gerado em:" -ForegroundColor Green
Write-Host " $ScriptDir\dist\" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Green
