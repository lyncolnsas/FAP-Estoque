#!/usr/bin/env bash

# ==============================================================================
#  FAP ESTOQUE - Inicializador em Modo Desenvolvimento (Linux / Raspberry Pi)
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=============================================="
echo "  Iniciando FAP ESTOQUE (Modo Desenvolvimento) "
echo "=============================================="

# Matar processos filhos ao sair (Ctrl+C)
trap 'kill $(jobs -p) 2>/dev/null' EXIT

echo "Iniciando Backend API na porta 3333..."
cd "$ROOT_DIR/slave-estoque-api"
npx ts-node src/index.ts &

echo "Iniciando Frontend PWA na porta 5173..."
cd "$ROOT_DIR/slave-estoque-pwa"
npm run dev -- --host &

echo "Pressione Ctrl+C para encerrar todos os serviços."
wait
