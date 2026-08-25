# Resumo de Altera√ß√µes (Sess√£o de Ajustes de Rede e Discovery)

> **AVISO:** Todo o c√≥digo j√° est√° salvo nos seus arquivos. Voc√™ pode mover a pasta do projeto com tranquilidade. Este arquivo √© apenas um log para voc√™ lembrar o que foi feito nesta sess√£o caso inicie um novo chat.

## 1. Libera√ß√£o de Tr√°fego HTTP (Erro de Network / UnknownServiceException)
Para evitar que o Android bloqueie requisi√ß√µes HTTP locais em texto plano (HTTP em vez de HTTPS):
- Editamos o **`slave-estoque-mobile/app.json`** e adicionamos `"usesCleartextTraffic": true`.
- Editamos o **`slave-estoque-mobile/android/app/src/main/AndroidManifest.xml`** e adicionamos a tag `android:usesCleartextTraffic="true"`.

## 2. Implementa√ß√£o do Auto-Scan Local (Ping Sweep via HTTP)
Para resolver o problema do PC ter m√∫ltiplas placas de rede (e o aplicativo se perder ao procurar o IP correto do servidor):
- **O que foi descartado:** Removemos toda a biblioteca nativa `react-native-udp` e a estrat√©gia de *broadcast UDP* que exigia recompila√ß√µes nativas complicadas. O arquivo `discovery.ts` da API foi deletado.
- **Na API (Node.js):** 
  - Adicionamos uma nova rota ultrarr√°pida: `GET /api/sync/ping` no arquivo `slave-estoque-api/src/routes/sync.routes.ts`.
  - Esta rota devolve um JSON espec√≠fico: `{ "service": "slave-estoque-server" }`.
- **No Mobile (React Native):**
  - Instalamos a biblioteca oficial `expo-network`.
  - Recriamos o arquivo `slave-estoque-mobile/src/services/discovery.js`.
  - O App agora descobre a subrede WiFi atual (ex: `192.168.0.x`) e tenta se conectar via `fetch` (HTTP) em todos os IPs do roteador (do `.1` ao `.254`) na porta `3333`.
  - Ao encontrar o IP que responde com a assinatura `"service": "slave-estoque-server"`, ele automaticamente trava esse IP e informa que o servidor foi encontrado.

## 3. Pr√≥ximo Passo P√≥s-Migra√ß√£o de Pasta
- A tentativa de criar o APK ( `gradlew assembleRelease` ) **falhou devido ao nome da pasta atual ser muito longo** (Limite de 260 caracteres do Windows).
- **A√ß√£o Requerida:** Ap√≥s renomear ou mover a pasta do seu projeto para um caminho curto (como `C:\estoque` ou `C:\dev\app-estoque`), abra o novo terminal nela, navegue at√© `android` e execute:
  ```bash
  cd android
  ./gradlew assembleRelease
  ```
  Isso ir√° finalmente gerar o seu `app-release.apk` sem os erros do `CMake` e `ninja`.

## AtualizaÁıes Recentes: AutenticaÁ„o Offline-First e Sync de Imagens

1. **AutenticaÁ„o Segura de SincronizaÁ„o**: O servidor (API) e o PWA passaram a exigir uma Palavra-Passe para liberaÁ„o do acesso e sincronismo, usando o cabeÁalho x-sync-password.
2. **Descoberta Inteligente (Mobile)**: O App Mobile implementou uma camada de discovery aprimorada que tenta o ping portando a senha salva offline. Erros 401 Unauthorized bloqueiam o handshake adequadamente, abrindo o modal visual pedindo a senha.
3. **ResiliÍncia de Teclado**: O aplicativo mÛvel recebeu tratamento via KeyboardAvoidingView no modal da Home e do Leitor de QRCode para evitar que o teclado nativo encubra os inputs em dispositivos menores.
4. **Cache FÌsico de Imagens (Offline Completo)**: O motor de sincronizaÁ„o (syncPull) do Mobile foi recriado para baixar via expo-file-system as miniaturas do servidor, reescrevendo o banco de dados interno com a URL local ile:///.... Isso tornou o acesso ao Acervo 100% independente de internet apÛs a SincronizaÁ„o.
