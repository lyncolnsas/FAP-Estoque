# 📖 Manual Completo de Compilação (EXE/APK) e Instalação em Servidor (Ubuntu / Raspberry Pi)

Este documento é o guia definitivo de engenharia do **FAP Estoque**, detalhando o processo de geração dos executáveis autônomos (Windows e Android) e a instalação do serviço central em servidores Linux (Ubuntu Server/Debian) ou mini-computadores Raspberry Pi.

---

## 📑 Sumário

1. [Visão Geral da Arquitetura do Sistema](#1-visão-geral-da-arquitetura-do-sistema)
2. [Geração do Executável Windows (.EXE) 100% Autossuficiente](#2-geração-do-executável-windows-exe-100-autossuficiente)
   - [2.1 Como Funciona o Empacotamento Autônomo (Zero Dependências)](#21-como-funciona-o-empacotamento-autônomo-zero-dependências)
   - [2.2 Pré-requisitos para Build no Windows](#22-pré-requisitos-para-build-no-windows)
   - [2.3 Comando de Geração Automatizada](#23-comando-de-geração-automatizada)
   - [2.4 Artefatos Gerados](#24-artefatos-gerados)
   - [2.5 Estrutura de Dados e Persistência](#25-estrutura-de-dados-e-persistência)
3. [Geração do Aplicativo Android (.APK) Offline-First](#3-geração-do-aplicativo-android-apk-offline-first)
   - [3.1 Arquitetura do Mobile](#31-arquitetura-do-mobile)
   - [3.2 Pré-requisitos de Compilação](#32-pré-requisitos-de-compilação)
   - [3.3 Comando de Compilação do APK](#33-comando-de-compilação-do-apk)
   - [3.4 Instalação e Pareamento no Coletor](#34-instalação-e-pareamento-no-coletor)
4. [Instalação do Serviço no Linux Ubuntu & Raspberry Pi](#4-instalação-do-serviço-no-linux-ubuntu--raspberry-pi)
   - [4.1 Instalação Automatizada (Recomendado)](#41-instalação-automatizada-recomendado)
   - [4.2 Instalação Manual Passo a Passo](#42-instalação-manual-passo-a-passo)
   - [4.3 Configuração do Systemd (Serviço em Segundo Plano)](#43-configuração-do-systemd-serviço-em-segundo-plano)
   - [4.4 Configuração do Nginx (Servidor Web & Proxy Reverso)](#44-configuração-do-nginx-servidor-web--proxy-reverso)
   - [4.5 Liberação do Firewall (UFW)](#45-liberação-do-firewall-ufw)
   - [4.6 Comandos de Gerenciamento do Servidor](#46-comandos-de-gerenciamento-do-servidor)
5. [Rotina de Backup e Restauração](#5-rotina-de-backup-e-restauração)

---

## 1. Visão Geral da Arquitetura do Sistema

```
                  ┌──────────────────────────────────────────────────────────┐
                  │                 DISPOSITIVOS CLIENTES                    │
                  │                                                          │
                  │   📱 App Mobile (APK)         💻 Navegadores na Rede     │
                  │   (Coletor Offline-First)      (Painel Web / PWA)        │
                  └─────────────┬────────────────────────────┬───────────────┘
                                │                            │
                      Porta 3333 (Sync / API)       Porta 80 (HTTP / Nginx)
                                │                            │
 ┌──────────────────────────────▼────────────────────────────▼─────────────────────────────┐
 │                      SERVIDOR / COMPUTADOR HOSPEDEIRO                                    │
 │                                                                                         │
 │   Opção A: Windows Executável (.exe)           Opção B: Linux / Raspberry Pi            │
 │   - Electron Runtime (Node.js embutido)        - Nginx (Porta 80)                       │
 │   - Express Static (Porta 3000)                - Systemd fap-api.service (Porta 3333)   │
 │   - Backend API (Porta 3333)                   - SQLite dev.db nativo                   │
 │   - SQLite dev.db em %APPDATA%                 - Armazenamento em /opt/fap-estoque      │
 └─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Geração do Executável Windows (.EXE) 100% Autossuficiente

### 2.1 Como Funciona o Empacotamento Autônomo (Zero Dependências)

O executável do **Painel FAP** foi desenhado com o padrão **Hermetic Self-Contained Deployment**:
- **Zero Instalação Externa:** O computador do cliente **NÃO** precisa ter Node.js, Python, Git, C++ Redistributable ou banco de dados instalado.
- **Node.js Embutido:** O Electron inclui o runtime V8/Node.js nativo. O `main.js` dispara a API usando `spawn(process.execPath, ['dist/index.js'], { env: { ELECTRON_RUN_AS_NODE: '1' } })`. O próprio binário do Electron roda o backend TypeScript/JavaScript.
- **Binários & DLLs Nativas:** Os binários nativos do **Prisma Query Engine** (`query-engine-windows.exe`), bibliotecas C++ e o banco SQLite são embutidos diretamente na pasta `resources/api` através do hook `afterPack.js`.
- **Proxy Interno:** O Electron sobe um servidor Express local que serve o PWA compilado e faz o roteamento reverso (`http-proxy-middleware`) para a API, eliminando bloqueios de CORS e requisições cruzadas.
- **Firewall Automático:** Ao abrir, o executável executa regras `netsh advfirewall` para garantir que a porta `3333` e o executável tenham permissão de tráfego na rede local privada para comunicação com o coletor mobile.

### 2.2 Pré-requisitos para Build no Windows

Na máquina de desenvolvimento (onde você compila o `.exe`):
- Windows 10 ou 11 (64-bit)
- Node.js LTS instalado (v18+)
- PowerShell (com permissão de execução de scripts)

### 2.3 Comando de Geração Automatizada

Abra o terminal na pasta raiz do projeto (`f:\QT` ou equivalente) e execute:

```powershell
# Execução direta do script de build:
powershell -ExecutionPolicy Bypass -File "f:\QT\FAP-Painel\build-exe.ps1"
```

#### O que o script `build-exe.ps1` faz por baixo dos panos:
1. **Ambiente Isolado (`temp_build`):** Cria um diretório limpo e copia `slave-estoque-api` e `slave-estoque-pwa` sem as pastas de desenvolvimento locais.
2. **Compilação do PWA:** Instala dependências limpas e executa `npm run build` gerando a pasta otimizada `dist/`.
3. **Compilação da API:** Instala as dependências, executa `npx prisma generate` (para baixar o binário do Prisma) e `npx tsc` (compilando TypeScript para JavaScript).
4. **Empacotamento com Electron Builder:** Executa `electron-builder` com targets `nsis` (instalador tradicional) e `portable` (executável sem instalação).
5. **Cópia do Instalador:** Copia o instalador final diretamente para a raiz do repositório como `Painel_FAP_Setup.exe`.

### 2.4 Artefatos Gerados

| Arquivo | Localização | Descrição |
|---|---|---|
| **`Painel_FAP_Setup.exe`** | `F:\QT\Painel_FAP_Setup.exe` | **Instalador Oficial:** Cria atalhos na Área de Trabalho e Menu Iniciar, registra desinstalador no Painel de Controle e configura o firewall. |
| **`Painel FAP 1.0.0.exe`** | `F:\QT\FAP-Painel\dist\` | **Versão Portátil:** Executa direto com 2 cliques sem instalar nada no sistema. |

### 2.5 Estrutura de Dados e Persistência

Para garantir que atualizações do software não apaguem o banco de dados do cliente, o banco SQLite e as imagens são salvos no diretório seguro do usuário:
- **Banco de Dados SQLite:** `%APPDATA%\Painel FAP\dev.db`
- **Fotos e Uploads:** `%APPDATA%\Painel FAP\uploads\`
- **Logs de Erro:** `%APPDATA%\Painel FAP\api-error.log`

---

## 3. Geração do Aplicativo Android (.APK) Offline-First

### 3.1 Arquitetura do Mobile

O aplicativo coletor (`slave-estoque-mobile`) utiliza **React Native** com **Expo Bare Workflow**:
- **Banco Local SQLite:** Armazenamento local via `expo-sqlite`, garantindo funcionamento total mesmo em galpões ou subsolos sem sinal de Wi-Fi.
- **Sincronização Bidirecional:** Handshake automático com a API via leitura de QR Code na tela do computador.

### 3.2 Pré-requisitos de Compilação

- **Java JDK:** JDK 17 instalado e configurado na variável de ambiente `JAVA_HOME`.
- **Android SDK:** Android SDK Platform 34+, Build Tools e NDK configurados no `ANDROID_HOME`.

### 3.3 Comando de Compilação do APK

No terminal:

```cmd
:: 1. Entrar na pasta do mobile
cd f:\QT\slave-estoque-mobile

:: 2. Executar o Gradle Release no Windows
cd android && gradlew.bat assembleRelease

:: 3. Copiar o APK gerado para a raiz do projeto
copy /Y app\build\outputs\apk\release\app-release.apk ..\..\app-release.apk
```

*(No Linux/macOS substitua `gradlew.bat` por `./gradlew assembleRelease`)*.

### 3.4 Instalação e Pareamento no Coletor

1. Transfira o arquivo `app-release.apk` (gerado na raiz) para o dispositivo Android via cabo USB, WhatsApp ou download direto.
2. Habilite a opção **"Instalar de fontes desconhecidas"** no Android e instale o app.
3. No computador, abra o **Painel FAP** e vá em **Integrações** > **Conectar Mobile**.
4. No aplicativo móvel, toque em **"Conectar ao Servidor"** e aponte a câmera para o QR Code exibido na tela do computador. A conexão e o token de rede são configurados instantaneamente.

---

## 4. Instalação do Serviço no Linux Ubuntu & Raspberry Pi

### 4.1 Instalação Automatizada (Recomendado)

O repositório já possui um script `install.sh` pronto para ambientes de produção.

#### Passo 1: Enviar o código para o servidor
```bash
# Clone ou envie para a pasta /opt:
sudo git clone https://github.com/lyncolnsas/FAP-Estoque.git /opt/fap-estoque
cd /opt/fap-estoque
```

#### Passo 2: Executar o Instalador
```bash
sudo bash install.sh
```

O script faz tudo de forma autônoma:
- Instala Node.js v20 LTS, Nginx, UFW, SQLite3 e OpenSSL.
- Instala as dependências npm e compila o PWA.
- Inicializa o banco SQLite e aplica migrações Prisma.
- Cria o serviço Systemd `fap-api.service` com inicialização automática no boot.
- Configura o Nginx na porta 80 com proxy reverso para a API.
- Configura e ativa o firewall UFW nas portas 80, 3333 e 22 (SSH).

---

### 4.2 Instalação Manual Passo a Passo

Caso deseje configurar manualmente sem usar o `install.sh`:

#### 1. Instalar Dependências do Sistema
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential sqlite3 libssl-dev openssl ufw nginx ca-certificates gnupg
```

#### 2. Instalar Node.js 20 LTS
```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt update && sudo apt install -y nodejs
sudo npm install -g ts-node typescript
```

#### 3. Configurar e Compilar o Backend (`slave-estoque-api`)
```bash
cd /opt/fap-estoque/slave-estoque-api

# Criar .env
cat << 'EOF' > .env
DATABASE_URL="file:./dev.db"
PORT=3333
NODE_ENV=production
UPLOAD_DIR="/opt/fap-estoque/slave-estoque-api/src/uploads"
EOF

# Criar diretório de fotos
mkdir -p src/uploads

# Instalar dependências e preparar banco
npm install
npx prisma generate
npx prisma db push
npx tsc
```

#### 4. Configurar e Compilar o Frontend (`slave-estoque-pwa`)
```bash
cd /opt/fap-estoque/slave-estoque-pwa
npm install --legacy-peer-deps
npm run build
```

---

### 4.3 Configuração do Systemd (Serviço em Segundo Plano)

Crie o arquivo do serviço no Systemd:

```bash
sudo nano /etc/systemd/system/fap-api.service
```

Cole a configuração:

```ini
[Unit]
Description=FAP Estoque - API Backend Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/fap-estoque/slave-estoque-api
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3333
Environment=DATABASE_URL=file:./dev.db
Environment=UPLOAD_DIR=/opt/fap-estoque/slave-estoque-api/src/uploads

[Install]
WantedBy=multi-user.target
```

Ative e inicialize o serviço:
```bash
sudo systemctl daemon-reload
sudo systemctl enable fap-api
sudo systemctl start fap-api
```

---

### 4.4 Configuração do Nginx (Servidor Web & Proxy Reverso)

Crie o bloco de configuração do site no Nginx:

```bash
sudo nano /etc/nginx/sites-available/fap-estoque
```

Cole o conteúdo:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 50M;

    # Frontend PWA Estático
    location / {
        root /opt/fap-estoque/slave-estoque-pwa/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy para API Backend
    location /api/ {
        proxy_pass http://127.0.0.1:3333/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Sincronização Mobile
    location /sync {
        proxy_pass http://127.0.0.1:3333/sync;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Uploads e Fotos
    location /uploads/ {
        proxy_pass http://127.0.0.1:3333/uploads/;
        proxy_set_header Host $host;
    }
}
```

Ative a configuração e reinicie o Nginx:
```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/fap-estoque /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### 4.5 Liberação do Firewall (UFW)

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # Painel Web PWA
sudo ufw allow 3333/tcp  # API Backend (Coletor Mobile)
sudo ufw --force enable
```

---

### 4.6 Comandos de Gerenciamento do Servidor

| Ação | Comando |
|---|---|
| **Verificar Status** | `sudo systemctl status fap-api` (ou `fap-status`) |
| **Ver Logs em Tempo Real** | `sudo journalctl -u fap-api -f` (ou `fap-logs`) |
| **Ver QR Code WhatsApp** | `sudo journalctl -u fap-api -n 50 --no-pager` (ou `fap-qr`) |
| **Reiniciar Serviço** | `sudo systemctl restart fap-api` (ou `fap-restart`) |
| **Atualizar Sistema (Git)** | `cd /opt/fap-estoque && sudo bash update.sh` |

---

## 5. Rotina de Backup e Restauração

Todos os dados críticos do sistema estão contidos em apenas **dois diretórios**:

1. **Arquivo do Banco SQLite:** `/opt/fap-estoque/slave-estoque-api/prisma/dev.db` (Linux) ou `%APPDATA%\Painel FAP\dev.db` (Windows).
2. **Pasta de Uploads (Fotos):** `/opt/fap-estoque/slave-estoque-api/src/uploads` (Linux) ou `%APPDATA%\Painel FAP\uploads` (Windows).

### Script de Backup Automático no Linux (Crontab)

Crie um script de backup em `/usr/local/bin/fap-backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/fap-estoque"
DATA=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Copia com segurança do SQLite
sqlite3 /opt/fap-estoque/slave-estoque-api/prisma/dev.db ".backup '$BACKUP_DIR/db_$DATA.sqlite'"

# Compacta fotos
tar -czf "$BACKUP_DIR/uploads_$DATA.tar.gz" -C /opt/fap-estoque/slave-estoque-api/src/ uploads

# Remove backups com mais de 30 dias
find "$BACKUP_DIR" -type f -mtime +30 -delete
```

Adicione ao crontab (`sudo crontab -e`):
```cron
# Executar backup diário às 03:00 da madrugada
0 3 * * * /bin/bash /usr/local/bin/fap-backup.sh
```
