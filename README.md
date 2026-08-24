# Slave Estoque - Sistema Integrado

Este repositório contém o sistema integrado **Slave Estoque**, que é composto por três aplicações principais operando em conjunto.

## Estrutura do Projeto

1. **`slave-estoque-api` (Backend)**
   - API REST desenvolvida com Node.js, Express e Prisma (SQLite).
   - Gerencia banco de dados local.
   - Fornece integração com WhatsApp (via `@whiskeysockets/baileys`).
   - Documentação específica em: [slave-estoque-api/API_ARCHITECTURE.md](slave-estoque-api/API_ARCHITECTURE.md)

2. **`slave-estoque-pwa` (Frontend / Painel Web)**
   - Painel administrativo construído com React, TypeScript, Vite e Tailwind.
   - Consome a API Backend.
   - Documentação específica em: [slave-estoque-pwa/PWA_ARCHITECTURE.md](slave-estoque-pwa/PWA_ARCHITECTURE.md)

3. **`slave-estoque-mobile` (Aplicativo Coletor)**
   - Aplicativo construído com React Native (Expo) seguindo modelo **Offline-First**.
   - Sincroniza dados com a API quando online na mesma rede.
   - Lê QR Codes e códigos de barra para baixa de equipamentos.
   - Documentação específica em: [slave-estoque-mobile/MOBILE_ARCHITECTURE.md](slave-estoque-mobile/MOBILE_ARCHITECTURE.md)

## Como Rodar o Sistema Localmente (Estado Atual)

O projeto possui scripts automatizados em lote (scripts `.bat`) na raiz para facilitar a inicialização no Windows.

### 1. Inicialização Integrada Rápida
Execute o arquivo na raiz do repositório:
```cmd
start.bat
```
- Este script subirá a API (na porta 3333) e o PWA simultaneamente em instâncias de terminal diferentes.
- A API irá inicializar e o módulo do WhatsApp pode pedir leitura de QR Code.

### 2. Rodar Manualmente

Caso prefira inicializar individualmente:

**Para a API:**
```bash
cd slave-estoque-api
npm install
npx prisma generate
npx prisma db push
npx ts-node src/index.ts
```

**Para o PWA (Painel):**
```bash
cd slave-estoque-pwa
npm install
npm run dev
```

**Para o Mobile (App):**
```bash
cd slave-estoque-mobile
npm install
npx expo start --clear
```

### 3. Configurações de Rede (Firewall)
O aplicativo Mobile (bem como qualquer acesso do PWA por outros computadores na rede LAN) precisa conseguir conectar à API.
Os scripts:
- `liberar_porta_firewall.bat`
- `fix_firewall.bat`
Podem ser rodados como Administrador no Windows hospedeiro para garantir que a porta `3333` TCP fique acessível em sub-redes da empresa, corrigindo problemas do Mobile não encontrar o servidor.
