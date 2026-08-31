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
robocopy $ApiSrc $ApiDest /E /XD node_modules .git dist /XF .env /R:1 /W:1 | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Warning "Robocopy API code: $LASTEXITCODE" }

Write-Host " Copiando PWA..."
robocopy $PwaSrc $PwaDest /E /XD node_modules .git dist /XF .env /R:1 /W:1 | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Warning "Robocopy PWA code: $LASTEXITCODE" }

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
npx tsc
if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar a API" }

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

# Copiar para a raiz D:\QT se gerado
$SetupSrc = Join-Path $ScriptDir "dist\Painel FAP Setup 1.0.0.exe"
if (-not (Test-Path $SetupSrc)) {
    $SetupSrc = Get-ChildItem (Join-Path $ScriptDir "dist") -Filter "*.exe" | Select-Object -First 1 -ExpandProperty FullName
}
if ($SetupSrc -and (Test-Path $SetupSrc)) {
    Copy-Item $SetupSrc (Join-Path $RootDir "Painel_FAP_Setup.exe") -Force
    Write-Host " Copiado para a raiz: $RootDir\Painel_FAP_Setup.exe" -ForegroundColor Green
}

Write-Host "`n=========================================" -ForegroundColor Green
Write-Host " SUCESSO! O arquivo .exe foi gerado em:" -ForegroundColor Green
Write-Host " $ScriptDir\dist\" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Green
