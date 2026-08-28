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

## 🔒 Atualizações Recentes do Sistema

1. **Gestão Completa de Solicitantes Avulsos & Promoção de Acesso:**
   - Empréstimos avulsos criados no Mobile ou PWA salvam automaticamente o solicitante no banco (`Usuario` com `role: 'AVULSO'`).
   - Gestão no painel com edição de nome, departamento e WhatsApp, além de botão para **"Dar Acesso ao Sistema"** (concede login/senha mantendo todo o histórico anterior).
   - Relatórios detalhados com contagem de requisições, total de itens retirados e itens atualmente em posse.
2. **Empréstimos Agrupados por Modelo com Seletor de Quantidade (Mobile):**
   - O aplicativo móvel agora agrupa aparelhos idênticos em cards únicos de modelo (ex: Par Led), com seletor interativo `[-] [ qtd ] [+]` e controle de estoque disponível em tempo real.
3. **Integração com Fotos de Perfil do WhatsApp:**
   - O backend busca automaticamente a foto oficial do perfil de contatos e usuários via Baileys (`sock.profilePictureUrl`) e sincroniza com o PWA e o App Mobile.
4. **Autenticação Segura de Sincronização e Palavra-Passe:**
   - O servidor (API) e o PWA utilizam validação de Palavra-Passe com cabeçalho `x-sync-password` e modal de autenticação com foco automático no app.
5. **Cache Físico de Imagens (Offline Completo):**
   - O motor `syncPull` do Mobile baixa e armazena localmente as fotos de equipamentos, locais e usuários no armazenamento interno (`file:///...`), permitindo visualização de fotos 100% offline.

---

## 📦 Artefatos e Executáveis de Produção

- 📱 **APK Android:** [`app-release.apk`](app-release.apk) *(Pronto para instalação em coletores e smartphones)*
- 🖥️ **Instalador Windows (EXE):** [`FAP-Painel/dist/Painel FAP Setup 1.0.0.exe`](FAP-Painel/dist/)
- 💼 **Executável Portátil (EXE):** [`FAP-Painel/dist/Painel FAP 1.0.0.exe`](FAP-Painel/dist/)
