# Slave Estoque PWA - Documenta√ß√£o e Arquitetura

Este documento descreve a arquitetura do frontend web (Painel Administrativo) do sistema de estoque.

## 1. Tecnologias Utilizadas
- **React** (v18) com **TypeScript** e **Vite**
- **Tailwind CSS** para estiliza√ß√£o
- **Radix UI** para componentes base acess√≠veis
- **Lucide React** para √≠cones
- **Capacitor** para encapsulamento como aplicativo Android caso necess√°rio (`painel-estoque.apk`)
- **React Router Dom** para navega√ß√£o

## 2. Estrutura do Projeto
- `src/pages/`: Telas do painel (ex: Dashboard, Equipamentos, Requisi√ß√µes, Reservas).
- `src/components/`: Componentes UI reutiliz√°veis (bot√µes, modais, formul√°rios).
- `src/contexts/`: Gerenciamento de estado global (ex: Contexto de Autentica√ß√£o).
- `src/lib/`: Utilit√°rios (ex: formatadores de data, integra√ß√µes).

## 3. Como Rodar o Projeto

### Pr√©-requisitos
- Node.js (v18+)
- A API (`slave-estoque-api`) deve estar rodando na porta 3333.

### Instala√ß√£o
1. Abra o terminal na pasta `slave-estoque-pwa`.
2. Instale as depend√™ncias:
   ```bash
   npm install
   ```

### Execu√ß√£o
Para iniciar o servidor de desenvolvimento do Vite:
```bash
npm run dev
```
O painel estar√° acess√≠vel geralmente em `http://localhost:5173`.
Para acesso em outros dispositivos na rede, utilize `npm run dev -- --host` (certifique-se de expor isso nas configura√ß√µes de script se for acessar de outra m√°quina).

### Build para Produ√ß√£o
```bash
npm run build
```
Os arquivos otimizados ser√£o gerados na pasta `dist/`.

## AtualizaÁıes Recentes: AutenticaÁ„o Offline-First e Sync de Imagens

1. **AutenticaÁ„o Segura de SincronizaÁ„o**: O servidor (API) e o PWA passaram a exigir uma Palavra-Passe para liberaÁ„o do acesso e sincronismo, usando o cabeÁalho x-sync-password.
2. **Descoberta Inteligente (Mobile)**: O App Mobile implementou uma camada de discovery aprimorada que tenta o ping portando a senha salva offline. Erros 401 Unauthorized bloqueiam o handshake adequadamente, abrindo o modal visual pedindo a senha.
3. **ResiliÍncia de Teclado**: O aplicativo mÛvel recebeu tratamento via KeyboardAvoidingView no modal da Home e do Leitor de QRCode para evitar que o teclado nativo encubra os inputs em dispositivos menores.
4. **Cache FÌsico de Imagens (Offline Completo)**: O motor de sincronizaÁ„o (syncPull) do Mobile foi recriado para baixar via expo-file-system as miniaturas do servidor, reescrevendo o banco de dados interno com a URL local ile:///.... Isso tornou o acesso ao Acervo 100% independente de internet apÛs a SincronizaÁ„o.
