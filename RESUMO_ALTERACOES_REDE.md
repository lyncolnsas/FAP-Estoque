# Resumo de Alterações (Sessão de Ajustes de Rede e Discovery)

> **AVISO:** Todo o código já está salvo nos seus arquivos. Você pode mover a pasta do projeto com tranquilidade. Este arquivo é apenas um log para você lembrar o que foi feito nesta sessão caso inicie um novo chat.

## 1. Liberação de Tráfego HTTP (Erro de Network / UnknownServiceException)
Para evitar que o Android bloqueie requisições HTTP locais em texto plano (HTTP em vez de HTTPS):
- Editamos o **`slave-estoque-mobile/app.json`** e adicionamos `"usesCleartextTraffic": true`.
- Editamos o **`slave-estoque-mobile/android/app/src/main/AndroidManifest.xml`** e adicionamos a tag `android:usesCleartextTraffic="true"`.

## 2. Implementação do Auto-Scan Local (Ping Sweep via HTTP)
Para resolver o problema do PC ter múltiplas placas de rede (e o aplicativo se perder ao procurar o IP correto do servidor):
- **O que foi descartado:** Removemos toda a biblioteca nativa `react-native-udp` e a estratégia de *broadcast UDP* que exigia recompilações nativas complicadas. O arquivo `discovery.ts` da API foi deletado.
- **Na API (Node.js):** 
  - Adicionamos uma nova rota ultrarrápida: `GET /api/sync/ping` no arquivo `slave-estoque-api/src/routes/sync.routes.ts`.
  - Esta rota devolve um JSON específico: `{ "service": "slave-estoque-server" }`.
- **No Mobile (React Native):**
  - Instalamos a biblioteca oficial `expo-network`.
  - Recriamos o arquivo `slave-estoque-mobile/src/services/discovery.js`.
  - O App agora descobre a subrede WiFi atual (ex: `192.168.0.x`) e tenta se conectar via `fetch` (HTTP) em todos os IPs do roteador (do `.1` ao `.254`) na porta `3333`.
  - Ao encontrar o IP que responde com a assinatura `"service": "slave-estoque-server"`, ele automaticamente trava esse IP e informa que o servidor foi encontrado.

## 3. Próximo Passo Pós-Migração de Pasta
- A tentativa de criar o APK ( `gradlew assembleRelease` ) **falhou devido ao nome da pasta atual ser muito longo** (Limite de 260 caracteres do Windows).
- **Ação Requerida:** Após renomear ou mover a pasta do seu projeto para um caminho curto (como `C:\estoque` ou `C:\dev\app-estoque`), abra o novo terminal nela, navegue até `android` e execute:
  ```bash
  cd android
  ./gradlew assembleRelease
  ```
  Isso irá finalmente gerar o seu `app-release.apk` sem os erros do `CMake` e `ninja`.
