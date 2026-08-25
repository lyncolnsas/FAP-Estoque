# FAP Estoque - Sistema Integrado

Este repositório contém o sistema integrado **FAP Estoque**, composto por três aplicações principais operando em conjunto.

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

---

## 🐧 Instalação em Linux (Ubuntu / Debian) e Raspberry Pi

Para servidores dedicados, mini PCs e Raspberry Pi (3, 4, 5, Zero 2W):

### 🚀 Instalação Automatizada (1 Comando)
Execute com permissões de administrador na raiz do projeto:
```bash
sudo bash install.sh
```
> O instalador prepara automaticamente o Node.js v20 LTS, dependências, banco SQLite, compilação do PWA, Nginx, Firewall UFW e inicialização como serviço de segundo plano no **Systemd** (`fap-api.service`).

📖 **Guia Completo e Detalhado:** Consulte o arquivo **[DOCS_LINUX_RASPBERRY.md](DOCS_LINUX_RASPBERRY.md)** para instruções passo a passo, configuração de IP estático, pareamento do WhatsApp e rotinas de backup.

### Comandos Rápidos no Linux / Raspberry Pi:
- `fap-status` — Verifica o status dos serviços.
- `fap-logs` (ou `fap-qr`) — Exibe os logs da API e o QR Code do WhatsApp.
- `fap-restart` — Reinicia a API e o Nginx.
- `sudo bash update.sh` — Atualiza o sistema via Git e recompila o PWA.
- `bash start-linux.sh` — Inicializa em modo de desenvolvimento interativo.

---

## 🪟 Como Rodar no Windows

O projeto possui scripts automatizados em lote (`.bat`) na raiz para facilitar a inicialização no Windows.

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

### 3. Configurações de Rede no Windows (Firewall)
O aplicativo Mobile (bem como qualquer acesso do PWA por outros computadores na rede LAN) precisa conseguir conectar à API.
Os scripts:
- `liberar_porta_firewall.bat`
- `fix_firewall.bat`
Podem ser rodados como Administrador no Windows hospedeiro para garantir que a porta `3333` TCP fique acessível em sub-redes da empresa.

---

## 🔒 Atualizações Recentes: Autenticação Offline-First e Sync de Imagens

1. **Autenticação Segura de Sincronização**: O servidor (API) e o PWA passaram a exigir uma Palavra-Passe para liberação do acesso e sincronismo, usando o cabeçalho `x-sync-password`.
2. **Descoberta Inteligente (Mobile)**: O App Mobile implementou uma camada de discovery aprimorada que tenta o ping portando a senha salva offline. Erros 401 Unauthorized bloqueiam o handshake adequadamente, abrindo o modal visual pedindo a senha.
3. **Resiliência de Teclado**: O aplicativo móvel recebeu tratamento via `KeyboardAvoidingView` no modal da Home e do Leitor de QRCode para evitar que o teclado nativo encubra os inputs em dispositivos menores.
4. **Cache Físico de Imagens (Offline Completo)**: O motor de sincronização (`syncPull`) do Mobile foi recriado para baixar via `expo-file-system` as miniaturas do servidor, reescrevendo o banco de dados interno com a URL local `file:///...`. Isso tornou o acesso ao Acervo 100% independente de internet após a Sincronização.
