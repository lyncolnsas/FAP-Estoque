# 🐧 Guia de Instalação e Operação - Linux Ubuntu & Raspberry Pi

Este documento fornece instruções completas, detalhadas e testadas para a instalação, configuração e execução em modo de produção do **FAP Estoque** em servidores **Linux Ubuntu** e dispositivos **Raspberry Pi** (Raspberry Pi OS / Debian).

---

## 📋 Sumário
1. [Visão Geral e Arquitetura](#-visão-geral-e-arquitetura)
2. [Requisitos de Hardware e Sistema](#-requisitos-de-hardware-e-sistema)
3. [Instalação Automatizada em 1 Comando (Recomendado)](#-instalação-automatizada-em-1-comando-recomendado)
4. [Instalação Manual Passo a Passo](#-instalação-manual-passo-a-passo)
5. [Configuração de Rede e IP Estático](#-configuração-de-rede-e-ip-estático)
6. [Pareamento do WhatsApp (Leitura do QR Code)](#-pareamento-do-whatsapp-leitura-do-qr-code)
7. [Integração com o Aplicativo Mobile (Coletor)](#-integração-com-o-aplicativo-mobile-coletor)
8. [Comandos Rápidos de Gerenciamento](#-comandos-rápidos-de-gerenciamento)
9. [Rotina de Backup e Restauração](#-rotina-de-backup-e-restauração)
10. [Resolução de Problemas (FAQ / Troubleshooting)](#-resolução-de-problemas-faq--troubleshooting)

---

## 🏛️ Visão Geral e Arquitetura

No ambiente Linux/Raspberry Pi, o FAP Estoque opera com a seguinte infraestrutura:

```
                  ┌──────────────────────────────────────────────┐
                  │          DISPOSITIVOS NA REDE LAN            │
                  │                                              │
                  │  📱 App Mobile (APK)    💻 Navegadores Web   │
                  └───────────────┬──────────────────┬───────────┘
                                  │                  │
               Porta 3333 (Sync / API)        Porta 80 (HTTP Web)
                                  │                  │
┌─────────────────────────────────▼──────────────────▼──────────────────────────┐
│                   SERVIDOR LINUX / RASPBERRY PI                               │
│                                                                               │
│  ┌──────────────────────────┐             ┌────────────────────────────────┐  │
│  │   NGINX (Web Server)     │             │   FAP API Backend (Node.js)    │  │
│  │   Porta 80               │             │   Porta 3333 (Systemd Service) │  │
│  │   - Serve PWA estático   │             │   - Express REST API           │  │
│  │   - Proxy reverso /api/  ├────────────►│   - Prisma ORM (SQLite)        │  │
│  │   - Proxy /uploads/      │             │   - Módulo WhatsApp (Baileys)  │  │
│  └──────────────────────────┘             │   - Rotinas de Lembrete Cron   │  │
│                                           └────────────────┬───────────────┘  │
│                                                            │                  │
│                                           ┌────────────────▼───────────────┐  │
│                                           │  Banco SQLite (dev.db)         │  │
│                                           │  Fotos e Anexos (/uploads)     │  │
│                                           └────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 💻 Requisitos de Hardware e Sistema

### 🍓 Raspberry Pi
- **Modelos Suportados:**
  - Raspberry Pi 5 (Todas as versões)
  - Raspberry Pi 4 Model B (2GB, 4GB ou 8GB de RAM)
  - Raspberry Pi 3 Model B / B+ (Mínimo 1GB RAM)
  - Raspberry Pi Zero 2 W (Recomendado criar arquivo de Swap de 1GB)
- **Sistema Operacional:**
  - Raspberry Pi OS (Debian 12 Bookworm ou Debian 11 Bullseye) - versões **64-bit** recomendadas.
- **Armazenamento:**
  - Cartão MicroSD Classe 10 A1/A2 de no mínimo 16GB (ou SSD conectado via USB para melhor desempenho e durabilidade).

### 🐧 Servidores Linux Ubuntu / Debian
- **Sistemas Operacionais:**
  - Ubuntu Server ou Desktop: 20.04 LTS, 22.04 LTS, 24.04 LTS.
  - Debian 11 (Bullseye) ou Debian 12 (Bookworm).
- **Arquitetura:** `x86_64` (Intel/AMD) ou `aarch64` (ARM).
- **Recursos Mínimos:** 1 CPU, 1GB RAM, 10GB de espaço em disco.

---

## 🚀 Instalação Automatizada em 1 Comando (Recomendado)

O repositório inclui o script [install.sh](file:///e:/QT/install.sh), que realiza toda a preparação do ambiente, instalação de pacotes, compilação do PWA, configuração do banco SQLite, criação de serviços no Systemd e regras de firewall.

### Passo 1: Transferir ou Clonar o Projeto para o Servidor

No terminal do seu Linux ou Raspberry Pi:
```bash
# Se clonar via Git:
git clone <URL_DO_REPOSITORIO> /opt/fap-estoque
cd /opt/fap-estoque

# Ou se transferiu os arquivos para uma pasta local:
cd ~/FAP-Estoque
```

### Passo 2: Executar o Instalador

```bash
sudo bash install.sh
```

### O que o instalador faz automaticamente:
1. ✅ Atualiza os repositórios `apt`.
2. ✅ Instala `curl`, `git`, `build-essential`, `sqlite3`, `libssl-dev`, `openssl`, `ufw` e `nginx`.
3. ✅ Configura e instala o **Node.js v20 LTS** oficial (NodeSource).
4. ✅ Instala todas as dependências npm do backend e frontend.
5. ✅ Gera os clientes do **Prisma ORM** e sincroniza a estrutura do banco SQLite `dev.db`.
6. ✅ Compila o **PWA (Painel Web)** para versão de produção ultrarrápida.
7. ✅ Cria e inicia o serviço de sistema `fap-api.service` no **Systemd** (com reinicialização automática no boot).
8. ✅ Configura o **Nginx** para servir o Painel na porta `80` com proxy seguro para a API.
9. ✅ Configura o Firewall `ufw` liberando as portas `80`, `3333` e `22` (SSH).
10. ✅ Cria utilitários de linha de comando (`fap-status`, `fap-logs`, `fap-restart`, `fap-qr`).

Ao término, o instalador exibirá o IP do servidor e os links prontos para uso.

---

## 🛠️ Instalação Manual Passo a Passo

Caso você queira entender ou executar cada etapa manualmente sem o script:

### 1. Instalar Dependências do Sistema Operacional
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential sqlite3 libssl-dev openssl ufw nginx ca-certificates gnupg
```

### 2. Instalar o Node.js 20 LTS
```bash
# Configurar repositório NodeSource v20
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list

sudo apt update
sudo apt install -y nodejs
sudo npm install -g ts-node typescript
```

### 3. Configurar o Backend (`slave-estoque-api`)
```bash
cd slave-estoque-api

# Criar arquivo de configuração .env
cat << 'EOF' > .env
DATABASE_URL="file:./dev.db"
PORT=3333
NODE_ENV=production
EOF

# Criar pasta de uploads de fotos
mkdir -p src/uploads

# Instalar pacotes e preparar banco de dados SQLite
npm install
npx prisma generate
npx prisma db push
```

### 4. Configurar e Compilar o Frontend (`slave-estoque-pwa`)
```bash
cd ../slave-estoque-pwa
npm install
npm run build
```

### 5. Configurar o Serviço de Segundo Plano (Systemd)
Crie o arquivo `/etc/systemd/system/fap-api.service`:
```bash
sudo nano /etc/systemd/system/fap-api.service
```
Cole o seguinte conteúdo (substitua `/caminho/do/projeto` e `seu_usuario` pelos valores reais):
```ini
[Unit]
Description=FAP Estoque Backend API
After=network.target

[Service]
Type=simple
User=seu_usuario
WorkingDirectory=/caminho/do/projeto/slave-estoque-api
ExecStart=/usr/bin/npx ts-node src/index.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3333
Environment=DATABASE_URL="file:./dev.db"
StandardOutput=journal
StandardError=journal
SyslogIdentifier=fap-api

[Install]
WantedBy=multi-user.target
```

Ative e inicie o serviço:
```bash
sudo systemctl daemon-reload
sudo systemctl enable fap-api
sudo systemctl start fap-api
```

### 6. Configurar o Nginx
Crie o arquivo `/etc/nginx/sites-available/fap-estoque`:
```bash
sudo nano /etc/nginx/sites-available/fap-estoque
```
Conteúdo:
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /caminho/do/projeto/slave-estoque-pwa/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3333/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 50M;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:3333/uploads/;
        proxy_set_header Host $host;
    }
}
```

Habilite o site no Nginx:
```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/fap-estoque /etc/nginx/sites-enabled/fap-estoque
sudo nginx -t && sudo systemctl restart nginx
```

---

## 🌐 Configuração de Rede e IP Estático

Para que o aplicativo móvel dos estoquistas e os computadores dos setores encontrem o servidor de forma confiável e permanente, é fundamental definir um **IP Fixo/Estático** para o servidor.

### Opção A: Raspberry Pi OS (NetworkManager / Bookworm)
Execute o assistente gráfico no terminal:
```bash
sudo nmtui
```
1. Selecione **"Edit a connection"** (Editar uma conexão).
2. Escolha sua conexão de rede (`Wired connection 1` para cabo ou seu Wi-Fi).
3. Mude a configuração de **IPv4** de `<Automatic>` para `<Manual>`.
4. Defina o IP estático (ex: `192.168.1.150/24`), Gateway (ex: `192.168.1.1`) e DNS (ex: `1.1.1.1, 8.8.8.8`).
5. Selecione `<OK>` e reinicie a interface de rede.

### Opção B: Ubuntu Server (Netplan)
Abra o arquivo de configuração do Netplan:
```bash
sudo nano /etc/netplan/00-installer-config.yaml
```
Exemplo de configuração para IP Fixo na interface `eth0`:
```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      dhcp4: no
      addresses:
        - 192.168.1.150/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses: [1.1.1.1, 8.8.8.8]
```
Aplique as alterações:
```bash
sudo netplan apply
```

---

## 💬 Pareamento do WhatsApp (Leitura do QR Code)

O backend possui integração nativa com o WhatsApp via Baileys para:
- 📲 Notificações automáticas de aceite de requisição.
- ⏰ Lembrete de devolução enviado 5 minutos antes do término do empréstimo.
- 📦 Alerta de devolução e baixa de avarias.

### Como Conectar o WhatsApp:
1. No terminal do servidor Linux / Raspberry Pi, execute:
   ```bash
   fap-logs
   # ou: journalctl -u fap-api -f -o cat
   ```
2. O terminal exibirá o **QR Code em ASCII**.
3. Abra o **WhatsApp** no smartphone responsável:
   - Vá em **Configurações / Opções** > **Aparelhos Conectados** > **Conectar um Aparelho**.
   - Aponte a câmera para o QR Code gerado no terminal.
4. Quando a mensagem `[WhatsApp] Conectado com sucesso na sessão system!` aparecer, a sessão está salva e pronta.
5. Pressione `Ctrl + C` para sair do visualizador de logs (o serviço continuará rodando em segundo plano).

---

## 📱 Integração com o Aplicativo Mobile (Coletor)

O aplicativo coletor (`slave-estoque-mobile` / APK) funciona em arquitetura **Offline-First**.

### Passo a Passo de Conexão no Celular:
1. Instale o APK no smartphone Android (leitor de código de barras / docas).
2. Conecte o smartphone na **mesma rede Wi-Fi** do Linux/Raspberry Pi.
3. Ao abrir o aplicativo pela primeira vez:
   - Se o discovery automático não detectar, informe o IP do servidor: `http://192.168.1.150:3333` (substitua pelo IP do seu servidor).
   - Digite a **Palavra-Passe de Sincronização** configurada no sistema.
4. Clique em **Sincronizar Acervo**:
   - O aplicativo baixará todos os equipamentos, categorias, pedidos ativos e fará o cache local das fotos no armazenamento do celular (`file:///...`).
5. A partir deste momento, o coletor opera 100% offline para conferência e baixas de patrimônio.

---

## ⚡ Comandos Rápidos de Gerenciamento

Após executar o `install.sh`, os seguintes comandos globais ficam disponíveis em qualquer terminal:

| Comando | O que faz |
| :--- | :--- |
| `fap-status` | Exibe o status detalhado dos serviços da API e do Nginx. |
| `fap-logs` (ou `fap-qr`) | Acompanha os logs da API em tempo real e exibe o QR Code do WhatsApp. |
| `fap-restart` | Reinicia a API e o servidor Nginx com segurança. |
| `fap-stop` | Para a execução do FAP Estoque. |
| `fap-start` | Inicia o FAP Estoque. |
| `sudo bash update.sh` | Atualiza o sistema via Git, atualiza banco de dados e recompila o PWA. |

---

## 💾 Rotina de Backup e Restauração

Todos os dados operacionais do FAP Estoque residem em dois locais fundamentais:
1. **Banco de Dados SQLite:** `slave-estoque-api/prisma/dev.db`
2. **Fotos e Anexos:** `slave-estoque-api/src/uploads/`

### 📦 Criando um Backup Manual
```bash
# Definir data
DATA=$(date +%Y%m%d_%H%M%S)

# Criar arquivo compactado de backup
sudo tar -czvf /home/$USER/backup_fap_estoque_$DATA.tar.gz \
    /caminho/do/projeto/slave-estoque-api/prisma/dev.db \
    /caminho/do/projeto/slave-estoque-api/src/uploads
```

### ⏰ Automatizando Backup Diário via Crontab
Abra o crontab:
```bash
sudo crontab -e
```
Adicione a linha para rodar todos os dias às 02:00 da manhã:
```cron
0 2 * * * tar -czvf /var/backups/fap_$(date +\%Y\%m\%d).tar.gz /caminho/do/projeto/slave-estoque-api/prisma/dev.db /caminho/do/projeto/slave-estoque-api/src/uploads >/dev/null 2>&1
```

### ♻️ Restaurando um Backup
Para restaurar em caso de troca de equipamento ou reinstalação:
1. Pare o serviço: `fap-stop`
2. Copie o arquivo `dev.db` de volta para `slave-estoque-api/prisma/dev.db`.
3. Copie as fotos de volta para `slave-estoque-api/src/uploads/`.
4. Reinicie o serviço: `fap-start`

---

## ❓ Resolução de Problemas (FAQ / Troubleshooting)

### 1. "Prisma engine binary error" ou falha ao rodar Prisma no Raspberry Pi
- **Causa:** O binário nativo do Prisma para arquiteturas ARM32 ou ARM64 precisa das bibliotecas OpenSSL.
- **Solução:**
  ```bash
  sudo apt install -y openssl libssl-dev
  cd slave-estoque-api
  npx prisma generate
  ```

### 2. O App Mobile não encontra o servidor
- Verifique se o smartphone está na mesma rede Wi-Fi e se o roteador não possui "Isolamento de AP" (Client Isolation) ativado.
- Verifique o firewall do Linux:
  ```bash
  sudo ufw status
  sudo ufw allow 3333/tcp
  sudo ufw allow 80/tcp
  ```
- Teste abrir `http://<IP_DO_SERVIDOR>:3333` no navegador do celular.

### 3. QR Code do WhatsApp expirou ou não carrega
- Execute `fap-restart` para forçar um novo ciclo de conexão e em seguida execute `fap-logs` para visualizar o novo QR Code.

### 4. Como alterar a porta da API ou do Painel?
- Para a API, altere a variável `PORT=3333` no arquivo `slave-estoque-api/.env` e no serviço `/etc/systemd/system/fap-api.service`.
- Para o Nginx (Painel Web), altere a linha `listen 80;` no arquivo `/etc/nginx/sites-available/fap-estoque`.

---

**FAP Estoque** — Sistema Integrado de Gestão de Estoque e Empréstimos.
