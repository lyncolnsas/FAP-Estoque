#!/usr/bin/env bash

# ==============================================================================
#  FAP ESTOQUE - Script de Instalação Automatizada
#  Compatível com: Ubuntu (20.04/22.04/24.04+), Debian (11/12+), Raspberry Pi OS
#  Arquiteturas: x86_64, aarch64 (ARM64), armv7l (ARM32)
# ==============================================================================

set -e

# Cores para logs no terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Funções auxiliares de log
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERRO]${NC} $1"
}

log_banner() {
    echo -e "${CYAN}${BOLD}"
    echo "================================================================================"
    echo "   _____ _          __      ________   ______  _____ _______ ____   ____  _    _ ______ "
    echo "  / ____| |   /\    \ \    / /  ____| |  ____|/ ____|__   __/ __ \ / __ \| |  | |  ____|"
    echo " | (___ | |  /  \    \ \  / /| |__    | |__  | (___    | | | |  | | |  | | |  | | |__   "
    echo "  \___ \| | / /\ \    \ \/ / |  __|   |  __|  \___ \   | | | |  | | |  | | |  | |  __|  "
    echo "  ____) | |/ ____ \    \  /  | |____  | |____ ____) |  | | | |__| | |__| | |__| | |____ "
    echo " |_____/|_/_/    \_\    \/   |______| |______|_____/   |_|  \____/ \___\_\\____/|______|"
    echo "================================================================================"
    echo -e "       Instalador Automatizado para Linux Ubuntu & Raspberry Pi OS${NC}\n"
}

# 1. Checagem de privilégios de ROOT
if [ "$EUID" -ne 0 ]; then
    log_error "Este instalador precisa ser executado com privilégios de ROOT (sudo)."
    echo -e "Por favor, execute: ${BOLD}sudo bash $0${NC}"
    exit 1
fi

# Detectar o usuário real (não root se executado via sudo)
REAL_USER=${SUDO_USER:-$USER}
REAL_HOME=$(getent passwd "$REAL_USER" | cut -d: -f6)
CURRENT_DIR=$(pwd)

log_banner

log_info "Iniciando processo de instalação do FAP Estoque..."
log_info "Usuário detectado para execução dos serviços: ${BOLD}$REAL_USER${NC}"
log_info "Diretório base: ${BOLD}$CURRENT_DIR${NC}"

# Detectar SO e Arquitetura
ARCH=$(uname -m)
OS_NAME="Desconhecido"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME=$NAME
fi
log_info "Sistema Operacional: ${BOLD}$OS_NAME${NC} ($ARCH)"

# Verificar se estamos dentro do repositório
if [ ! -d "$CURRENT_DIR/slave-estoque-api" ] || [ ! -d "$CURRENT_DIR/slave-estoque-pwa" ]; then
    log_error "Diretórios do projeto não encontrados no caminho atual ($CURRENT_DIR)."
    log_error "Certifique-se de executar o script a partir da raiz do repositório clonado."
    exit 1
fi

# 2. Atualizar pacotes e instalar dependências essenciais do sistema
log_info "Atualizando lista de pacotes e instalando dependências do sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    openssl \
    libssl-dev \
    sqlite3 \
    ufw \
    nginx \
    ca-certificates \
    gnupg \
    procps \
    net-tools

log_success "Dependências do sistema instaladas com sucesso."

# 3. Instalação do Node.js LTS (v20)
NODE_INSTALLED=false
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        log_success "Node.js já instalado na versão compatível: $(node -v)"
        NODE_INSTALLED=true
    else
        log_warn "Node.js encontrado, mas versão antiga ($(node -v)). Atualizando para v20 LTS..."
    fi
fi

if [ "$NODE_INSTALLED" = false ]; then
    log_info "Configurando repositório do Node.js 20.x LTS (NodeSource)..."
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
    apt-get update -y
    apt-get install -y nodejs
    log_success "Node.js instalado: $(node -v) com npm $(npm -v)"
fi

# Instalar ts-node, typescript e pm2 globalmente se necessário
npm install -g ts-node typescript pm2 serve >/dev/null 2>&1 || true

# 4. Configuração do Backend (slave-estoque-api)
log_info "Configurando o Backend (slave-estoque-api)..."
cd "$CURRENT_DIR/slave-estoque-api"

# Criar .env caso não exista
if [ ! -f .env ]; then
    log_info "Criando arquivo .env padrão da API..."
    cat << 'EOF' > .env
DATABASE_URL="file:./dev.db"
PORT=3333
NODE_ENV=production
EOF
    chown "$REAL_USER:$REAL_USER" .env
fi

# Garantir pasta de uploads
mkdir -p src/uploads
chown -R "$REAL_USER:$REAL_USER" src/uploads

# Instalar dependências da API
log_info "Instalando dependências npm da API (pode levar alguns minutos no Raspberry Pi)..."
sudo -u "$REAL_USER" npm install

# Gerar cliente Prisma e migrar banco SQLite
log_info "Gerando cliente Prisma e atualizando esquema SQLite..."
sudo -u "$REAL_USER" npx prisma generate
sudo -u "$REAL_USER" npx prisma db push

log_success "Backend configurado com sucesso."

# 5. Configuração do Frontend PWA (slave-estoque-pwa)
log_info "Configurando o Frontend PWA (slave-estoque-pwa)..."
cd "$CURRENT_DIR/slave-estoque-pwa"

# Instalar dependências do PWA
log_info "Instalando dependências npm do PWA..."
sudo -u "$REAL_USER" npm install

# Compilar para Produção (Build)
log_info "Compilando PWA para produção (Vite build)..."
sudo -u "$REAL_USER" npm run build

log_success "Frontend PWA compilado com sucesso na pasta 'dist'."

# 6. Criação do Serviço Systemd para a API (fap-api.service)
log_info "Configurando serviço Systemd para a API (fap-api.service)..."
cat << EOF > /etc/systemd/system/fap-api.service
[Unit]
Description=FAP Estoque Backend API
After=network.target

[Service]
Type=simple
User=$REAL_USER
WorkingDirectory=$CURRENT_DIR/slave-estoque-api
ExecStart=$(which npx) ts-node src/index.ts
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
EOF

# 7. Configuração do Nginx para servir o PWA e fazer Proxy reverso
log_info "Configurando Nginx para servir o Painel Web (PWA) e Proxy para a API..."

NGINX_CONF="/etc/nginx/sites-available/fap-estoque"
cat << EOF > "$NGINX_CONF"
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    # Diretório estático do PWA compilado
    root $CURRENT_DIR/slave-estoque-pwa/dist;
    index index.html;

    # Suporte para SPA (Single Page Application - React Router)
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy para a API Backend (porta 3333)
    location /api/ {
        proxy_pass http://127.0.0.1:3333/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 50M;
    }

    # Proxy direto para a rota de uploads
    location /uploads/ {
        proxy_pass http://127.0.0.1:3333/uploads/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # Configuração de cache para estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
EOF

# Habilitar site no Nginx
rm -f /etc/nginx/sites-enabled/default
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/fap-estoque
nginx -t && systemctl reload nginx || systemctl restart nginx

# 8. Habilitar e Iniciar Serviços
log_info "Iniciando e habilitando serviços no boot do sistema..."
systemctl daemon-reload
systemctl enable fap-api
systemctl restart fap-api
systemctl enable nginx
systemctl restart nginx

# 9. Configuração de Firewall (UFW)
log_info "Configurando regras do Firewall (UFW)..."
if command -v ufw >/dev/null 2>&1; then
    ufw allow 22/tcp comment 'SSH' >/dev/null 2>&1 || true
    ufw allow 80/tcp comment 'FAP Painel Web (HTTP)' >/dev/null 2>&1 || true
    ufw allow 3333/tcp comment 'FAP API Backend' >/dev/null 2>&1 || true
    ufw allow 5173/tcp comment 'Vite Dev (Opcional)' >/dev/null 2>&1 || true
    log_success "Portas 80 (Web), 3333 (API) e 22 (SSH) liberadas no UFW."
fi

# 10. Criação de Comandos de Atalho (CLI Utilities)
log_info "Criando comandos auxiliares de gerenciamento no sistema..."

# Atalho: fap-status
cat << 'EOF' > /usr/local/bin/fap-status
#!/usr/bin/env bash
echo "=========================================="
echo "    STATUS DOS SERVIÇOS FAP ESTOQUE"
echo "=========================================="
systemctl status fap-api --no-pager -l
echo "------------------------------------------"
systemctl status nginx --no-pager -l
echo "=========================================="
EOF
chmod +x /usr/local/bin/fap-status

# Atalho: fap-logs / fap-qr
cat << 'EOF' > /usr/local/bin/fap-logs
#!/usr/bin/env bash
echo "Exibindo logs em tempo real da API (Pressione Ctrl+C para sair)..."
journalctl -u fap-api -f -o cat
EOF
chmod +x /usr/local/bin/fap-logs
ln -sf /usr/local/bin/fap-logs /usr/local/bin/fap-qr

# Atalho: fap-restart
cat << 'EOF' > /usr/local/bin/fap-restart
#!/usr/bin/env bash
echo "Reiniciando serviços FAP Estoque..."
systemctl restart fap-api
systemctl restart nginx
echo "Serviços reiniciados com sucesso!"
EOF
chmod +x /usr/local/bin/fap-restart

# Atalho: fap-stop
cat << 'EOF' > /usr/local/bin/fap-stop
#!/usr/bin/env bash
echo "Parando serviços FAP Estoque..."
systemctl stop fap-api
echo "API finalizada."
EOF
chmod +x /usr/local/bin/fap-stop

# Atalho: fap-start
cat << 'EOF' > /usr/local/bin/fap-start
#!/usr/bin/env bash
echo "Iniciando serviços FAP Estoque..."
systemctl start fap-api
systemctl start nginx
echo "Serviços iniciados."
EOF
chmod +x /usr/local/bin/fap-start

# 11. Obter IPs locais para exibir na mensagem final
IP_LOCAL=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$IP_LOCAL" ]; then
    IP_LOCAL="SEU_IP_LOCAL"
fi

# 12. Mensagem Final
echo ""
echo -e "${GREEN}${BOLD}================================================================================"
echo -e "          🎉 INSTALAÇÃO DO FAP ESTOQUE CONCLUÍDA COM SUCESSO! 🎉"
echo -e "================================================================================${NC}"
echo ""
echo -e "📌 ${BOLD}ENDEREÇOS DE ACESSO NA REDE LOCAL:${NC}"
echo -e "  🌐 ${BOLD}Painel Administrativo (Web):${NC}  http://${IP_LOCAL} (ou http://localhost)"
echo -e "  ⚙️  ${BOLD}API Backend:${NC}                  http://${IP_LOCAL}:3333"
echo -e "  📱 ${BOLD}Configuração no App Mobile:${NC}   IP: ${BOLD}${IP_LOCAL}${NC} (Porta 3333)"
echo ""
echo -e "🔑 ${BOLD}CREDENCIAIS PADRÃO DO ADMINISTRADOR:${NC}"
echo -e "  📧 E-mail: ${BOLD}admin@admin.com${NC}"
echo -e "  🔒 Senha:  ${BOLD}123${NC}"
echo ""
echo -e "💬 ${BOLD}CONEXÃO COM O WHATSAPP (LEITURA DO QR CODE):${NC}"
echo -e "  Para ver o QR Code e parear o WhatsApp, execute no terminal:"
echo -e "  👉 ${CYAN}${BOLD}fap-logs${NC} (ou ${CYAN}${BOLD}fap-qr${NC})"
echo ""
echo -e "🛠️  ${BOLD}COMANDOS ÚTEIS NO TERMINAL:${NC}"
echo -e "  • ${CYAN}fap-status${NC}   -> Verifica se o sistema está rodando normalmente"
echo -e "  • ${CYAN}fap-logs${NC}     -> Acompanha os logs da API e QR Code do WhatsApp em tempo real"
echo -e "  • ${CYAN}fap-restart${NC}  -> Reinicia os servidores da API e Painel Web"
echo -e "  • ${CYAN}fap-stop${NC}     -> Interrompe a execução dos serviços"
echo -e "  • ${CYAN}fap-start${NC}    -> Inicia a execução dos serviços"
echo ""
echo -e "================================================================================"
echo -e "O sistema foi configurado como serviço do sistema e iniciará automaticamente"
echo -e "sempre que o computador ou Raspberry Pi for ligado ou reiniciado."
echo -e "================================================================================"
echo ""
