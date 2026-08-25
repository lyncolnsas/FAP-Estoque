# Slave Estoque API - Documenta√ß√£o e Arquitetura

Este documento descreve a arquitetura do servidor backend (API) do sistema de estoque.

## 1. Tecnologias Utilizadas
- **Node.js** com **Express** e **TypeScript**
- **Prisma ORM** com **SQLite** (banco de dados em `prisma/dev.db`)
- **Baileys** (`@whiskeysockets/baileys`) para integra√ß√£o com WhatsApp
- **JWT (JSON Web Token)** para autentica√ß√£o
- **Multer** para upload de imagens (salvas na pasta `uploads/`)

## 2. Estrutura do Banco de Dados
A API gerencia os seguintes modelos principais (ver `prisma/schema.prisma`):
- `Usuario`, `Equipamento`, `Categoria`, `TipoEquipamento`, `Requisicao`, `ItemRequisicao`, `Local`, `ReservaLocal`, `HistoricoAvaria`.

## 3. Integra√ß√£o com WhatsApp
A API possui um m√≥dulo de WhatsApp acoplado (`src/whatsapp.ts`) que exige leitura de QR Code no terminal durante a primeira inicializa√ß√£o para disparar mensagens de notifica√ß√µes (ex: aprova√ß√£o de requisi√ß√µes, lembretes de devolu√ß√£o).

## 4. Como Rodar o Projeto

### Pr√©-requisitos
- Node.js (v18+)

### Instala√ß√£o
1. Abra o terminal na pasta `slave-estoque-api`.
2. Instale as depend√™ncias:
   ```bash
   npm install
   ```
3. Gere o cliente Prisma e sincronize o banco de dados (cria o arquivo SQLite localmente):
   ```bash
   npx prisma generate
   npx prisma db push
   ```
4. (Opcional) Popule o banco com dados iniciais se necess√°rio:
   ```bash
   npx ts-node seed_custom.ts
   ```

### Execu√ß√£o
Para iniciar o servidor de desenvolvimento:
```bash
npx ts-node src/index.ts
```
O servidor ir√° rodar na porta **3333** (`http://localhost:3333`) e deve estar acess√≠vel na rede local para que o Mobile e o PWA possam se comunicar. No Windows, pode ser necess√°rio liberar a porta 3333 no firewall.

## AtualizaÁıes Recentes: AutenticaÁ„o Offline-First e Sync de Imagens

1. **AutenticaÁ„o Segura de SincronizaÁ„o**: O servidor (API) e o PWA passaram a exigir uma Palavra-Passe para liberaÁ„o do acesso e sincronismo, usando o cabeÁalho x-sync-password.
2. **Descoberta Inteligente (Mobile)**: O App Mobile implementou uma camada de discovery aprimorada que tenta o ping portando a senha salva offline. Erros 401 Unauthorized bloqueiam o handshake adequadamente, abrindo o modal visual pedindo a senha.
3. **ResiliÍncia de Teclado**: O aplicativo mÛvel recebeu tratamento via KeyboardAvoidingView no modal da Home e do Leitor de QRCode para evitar que o teclado nativo encubra os inputs em dispositivos menores.
4. **Cache FÌsico de Imagens (Offline Completo)**: O motor de sincronizaÁ„o (syncPull) do Mobile foi recriado para baixar via expo-file-system as miniaturas do servidor, reescrevendo o banco de dados interno com a URL local ile:///.... Isso tornou o acesso ao Acervo 100% independente de internet apÛs a SincronizaÁ„o.
