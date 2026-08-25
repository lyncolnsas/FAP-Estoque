#!/usr/bin/env bash

# ==============================================================================
#  FAP ESTOQUE - Script de Atualização
#  Atualiza o repositório, dependências, banco de dados e recompila o PWA
# ==============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BLUE}[INFO] Atualizando FAP Estoque...${NC}"

# Obter diretório do script
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo -e "${BLUE}[1/4] Baixando atualizações do Git...${NC}"
git pull || echo "Aviso: git pull não executado ou repositório sem remote."

echo -e "${BLUE}[2/4] Atualizando API e Banco de Dados...${NC}"
cd "$ROOT_DIR/slave-estoque-api"
npm install
npx prisma generate
npx prisma db push

echo -e "${BLUE}[3/4] Recompilando Painel PWA...${NC}"
cd "$ROOT_DIR/slave-estoque-pwa"
npm install
npm run build

echo -e "${BLUE}[4/4] Reiniciando serviços...${NC}"
if systemctl is-active --quiet fap-api; then
    sudo systemctl restart fap-api
    sudo systemctl reload nginx 2>/dev/null || true
    echo -e "${GREEN}[OK] Serviços systemd reiniciados!${NC}"
fi

echo -e "${GREEN}${BOLD}FAP Estoque atualizado com sucesso!${NC}"
