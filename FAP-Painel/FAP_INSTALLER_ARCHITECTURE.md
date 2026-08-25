# FAP Painel - Arquitetura do Instalador (Empacotamento)

Este documento define a estratégia e arquitetura utilizada para converter o sistema de estoque (API Express e Painel PWA) em um executável instalador único (Standalone), **sem sujar ou alterar o código-fonte original dos projetos base**.

## 1. Estratégia de Isolamento (Monorepo Virtual no Build)

Para não poluir as pastas `slave-estoque-api` e `slave-estoque-pwa`, o processo de build é totalmente isolado dentro do diretório `FAP-Painel`.
O fluxo funciona assim:

1. **Clonagem Interna:** O script de compilação (`build-exe.ps1`) cria uma subpasta temporária chamada `temp_build/`.
2. **Transferência:** Ele copia o código fonte bruto da API e do PWA das pastas irmãs para o `temp_build/api` e `temp_build/pwa`.
3. **Instalação Local:** O script entra nessas pastas copiadas e roda o `npm install`. *Isso garante que as dependências instaladas correspondam perfeitamente à compilação, sem gerar conflitos com o desenvolvimento normal.*
4. **Prisma e SQLite:** O `npx prisma generate` é acionado dentro de `temp_build/api`. Isso assegura que o Prisma Engine C/C++ apropriado seja encapsulado com o empacotamento.
5. **Compilação do PWA:** O Frontend é buildado para `temp_build/pwa/dist`.
6. **Electron Builder:** Por fim, o Electron junta o seu `main.js`, orquestra tudo, engole a pasta `temp_build` e gera o `app.exe` e o `Instalador.exe`.

## 2. Orquestração no Desktop (Electron)

A API do sistema depende de portas, banco SQLite (persistente) e permissões de Firewall. O aplicativo Electron atua como Maestro:

### 2.1 - Persistência do Banco de Dados
A API, ao rodar localmente no Windows (`Program Files`), não tem permissão para escrever o `dev.db` (SQLite). 
A lógica em `main.js` intercepta isso:
- Na primeira execução após instalar, o app clona o banco de dados original (vazio ou preenchido na hora do build) e o envia para `C:\Users\NOME\AppData\Roaming\fap-painel\dev.db`.
- O processo interno Node da API é acionado passando a variável `DATABASE_URL` direcionada para este local persistente no AppData.
- As imagens (`uploads`) também são movidas para `AppData` pelo mesmo motivo de I/O em leitura-escrita.

### 2.2 - Proxy Embutido e Porta
- O Express inicializado no Electron abre a porta 3000 e exibe os estáticos (`dist` do PWA).
- Ele atua como **Proxy Reverso**, pegando qualquer requisição `/api`, `/upload`, ou `/sync` e empurrando silenciosamente para a porta `3333` (onde o processo da API Node está escutando no fundo).
- O script injeta o NodeJS na API usando a funcionalidade nativa do Electron `ELECTRON_RUN_AS_NODE='1'`, eliminando a necessidade de qualquer máquina ter o Node instalado de forma global.

### 2.3 - Firewall Integrado
Na inicialização (evento App Ready), a rotina verifica se já existe uma regra de firewall permitindo o Painel ser acessível. Caso não haja, um script `UAC` (elevação de administrador) silenciosa é montado (`netsh advfirewall`) e disparado, poupando o usuário final de fazê-lo manualmente.

---

> **Atenção (Manutenção)**: Sempre que fizer alterações no mobile, api ou PWA, não precisa atualizar nada nesta pasta. Apenas rode o script de build novamente e ele puxará a versão mais fresca automaticamente.

## Atualiza��es Recentes: Autentica��o Offline-First e Sync de Imagens

1. **Autentica��o Segura de Sincroniza��o**: O servidor (API) e o PWA passaram a exigir uma Palavra-Passe para libera��o do acesso e sincronismo, usando o cabe�alho x-sync-password.
2. **Descoberta Inteligente (Mobile)**: O App Mobile implementou uma camada de discovery aprimorada que tenta o ping portando a senha salva offline. Erros 401 Unauthorized bloqueiam o handshake adequadamente, abrindo o modal visual pedindo a senha.
3. **Resili�ncia de Teclado**: O aplicativo m�vel recebeu tratamento via KeyboardAvoidingView no modal da Home e do Leitor de QRCode para evitar que o teclado nativo encubra os inputs em dispositivos menores.
4. **Cache F�sico de Imagens (Offline Completo)**: O motor de sincroniza��o (syncPull) do Mobile foi recriado para baixar via expo-file-system as miniaturas do servidor, reescrevendo o banco de dados interno com a URL local ile:///.... Isso tornou o acesso ao Acervo 100% independente de internet ap�s a Sincroniza��o.
