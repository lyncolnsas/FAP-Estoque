# Slave Estoque API - Documentação e Arquitetura

Este documento descreve a arquitetura do servidor backend (API) do sistema de estoque.

## 1. Tecnologias Utilizadas
- **Node.js** com **Express** e **TypeScript**
- **Prisma ORM** com **SQLite** (banco de dados em `prisma/dev.db`)
- **Baileys** (`@whiskeysockets/baileys`) para integração com WhatsApp
- **JWT (JSON Web Token)** para autenticação
- **Multer** para upload de imagens (salvas na pasta `uploads/`)

## 2. Estrutura do Banco de Dados
A API gerencia os seguintes modelos principais (ver `prisma/schema.prisma`):
- `Usuario`, `Equipamento`, `Categoria`, `TipoEquipamento`, `Requisicao`, `ItemRequisicao`, `Local`, `ReservaLocal`, `HistoricoAvaria`.

## 3. Integração com WhatsApp
A API possui um módulo de WhatsApp acoplado (`src/whatsapp.ts`) que exige leitura de QR Code no terminal durante a primeira inicialização para disparar mensagens de notificações (ex: aprovação de requisições, lembretes de devolução).

## 4. Como Rodar o Projeto

### Pré-requisitos
- Node.js (v18+)

### Instalação
1. Abra o terminal na pasta `slave-estoque-api`.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Gere o cliente Prisma e sincronize o banco de dados (cria o arquivo SQLite localmente):
   ```bash
   npx prisma generate
   npx prisma db push
   ```
4. (Opcional) Popule o banco com dados iniciais se necessário:
   ```bash
   npx ts-node seed_custom.ts
   ```

### Execução
Para iniciar o servidor de desenvolvimento:
```bash
npx ts-node src/index.ts
```
O servidor irá rodar na porta **3333** (`http://localhost:3333`) e deve estar acessível na rede local para que o Mobile e o PWA possam se comunicar. No Windows, pode ser necessário liberar a porta 3333 no firewall.
