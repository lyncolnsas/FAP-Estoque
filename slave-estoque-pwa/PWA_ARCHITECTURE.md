# Slave Estoque PWA - Documentação e Arquitetura

Este documento descreve a arquitetura do frontend web (Painel Administrativo) do sistema de estoque.

## 1. Tecnologias Utilizadas
- **React** (v18) com **TypeScript** e **Vite**
- **Tailwind CSS** para estilização
- **Radix UI** para componentes base acessíveis
- **Lucide React** para ícones
- **Capacitor** para encapsulamento como aplicativo Android caso necessário (`painel-estoque.apk`)
- **React Router Dom** para navegação

## 2. Estrutura do Projeto
- `src/pages/`: Telas do painel (ex: Dashboard, Equipamentos, Requisições, Reservas).
- `src/components/`: Componentes UI reutilizáveis (botões, modais, formulários).
- `src/contexts/`: Gerenciamento de estado global (ex: Contexto de Autenticação).
- `src/lib/`: Utilitários (ex: formatadores de data, integrações).

## 3. Como Rodar o Projeto

### Pré-requisitos
- Node.js (v18+)
- A API (`slave-estoque-api`) deve estar rodando na porta 3333.

### Instalação
1. Abra o terminal na pasta `slave-estoque-pwa`.
2. Instale as dependências:
   ```bash
   npm install
   ```

### Execução
Para iniciar o servidor de desenvolvimento do Vite:
```bash
npm run dev
```
O painel estará acessível geralmente em `http://localhost:5173`.
Para acesso em outros dispositivos na rede, utilize `npm run dev -- --host` (certifique-se de expor isso nas configurações de script se for acessar de outra máquina).

### Build para Produção
```bash
npm run build
```
Os arquivos otimizados serão gerados na pasta `dist/`.
