# Slave Estoque Mobile - Documentação Técnica e Arquitetura

> **ATENÇÃO:** Este documento é um blueprint técnico detalhado do aplicativo React Native/Expo. Ele descreve a lógica interna, funções, schemas de banco de dados e fluxos de dados. Este arquivo é a **Fonte da Verdade** (Source of Truth) para reversões de código e não deve ser alterado a menos que expressamente solicitado.

---

## 1. Banco de Dados Local (`src/db/database.js`)
O aplicativo opera no modelo **Offline-First**, centralizado no SQLite (`expo-sqlite/legacy`).

### 1.1 Schema e Tabelas
A função `initDB()` cria o seguinte schema relacional:
- **`Equipamento`**: `id`, `codigoPatrimonio`, `nome`, `categoriaId`, `tipoId`, `statusCondicao`, `permitirEmprestimo` (int), `recebeuComDefeito` (int), `fotoUrl` (caminho local file://), `synced`.
- **`Requisicao`**: `id`, `solicitanteNome`, `departamento`, `status`.
- **`ItemRequisicao`**: Relaciona Requisição e Equipamento. Usa `statusSeparacao` (0/1) e `statusDevolucao` (0/1) para rastrear o progresso.
- **`TipoAvaria`** e **`HistoricoAvaria`**: Registram defeitos com data, id de equipamento e se foi `resolvido`.
- **`Usuario`**: Sincroniza a tabela do painel para autocompletar na separação avulsa.
- **`OfflineLog`**: Tabela central do motor offline. Campos: `id` (AutoInc), `tipo` (Ação), `itemId`, `dados` (Payload JSON stringificado), `data`, e `synced`.

---

## 2. Motor de Sincronização (`src/services/api.js`)

A API local mantém o estado em `API_URL`, definida via `setApiUrl(ip, port)`.

### 2.1 Sync Pull (`syncPull()`)
- **Comportamento:** Faz requisição `GET /sync/pull`.
- **Lógica de Gravação:** Dá `DELETE` incondicional (em registros onde `synced = 1`) nas tabelas locais e faz `INSERT OR REPLACE` com o pacote recebido.
- **Proteção:** Registros gerados localmente (onde `synced = 0`) nunca são sobrescritos ou apagados por este processo.

### 2.2 Sync Push (`syncPush()`)
Processa a tabela `OfflineLog` via `POST /sync/push`.
- **Etapa 1 - Multiparts (Upload de Fotos):** Percorre os logs e checa se `tipo === 'NOVO_EQUIPAMENTO'` e se `fotoUrl` contém `file://`. Caso positivo, usa `FileSystem.uploadAsync` (`uploadType: 1 / MULTIPART`) para o endpoint `/upload`. A URL definitiva de resposta substitui a propriedade local. Se falhar, o envio desse log específico é abortado.
- **Etapa 2 - Envio de JSON:** Agrupa as ações processadas em um array `acoes`, e envia no formato `{ acoes: [...] }`.
- **Limpeza:** Após o retorno `success: true` do servidor, executa `UPDATE OfflineLog SET synced = 1` apenas para os IDs transmitidos.

### 2.3 Handshake e Configuração de QR Code (`parseQrCode`, `handshake`)
- O servidor gera um QR Code cujo conteúdo é criptografado com AES usando a constante `SECRET_KEY = 'minha-chave-secreta-estoque-123'`.
- O app descriptografa para `{ ips, port }` usando `CryptoJS.AES.decrypt`.
- Dispara `handshake(ip, port)`: Faz fetch com `AbortController` (timeout 3000ms) para `/sync/ping`. O sucesso é condicionado a receber a resposta `{ service: 'slave-estoque-server' }`.

---

## 3. Descoberta Automática de Rede (`src/services/discovery.js`)

- **Método `scanNetworkForServer(onProgress)`:** Resolve o IP do dispositivo usando `Network.getIpAddressAsync()`.
- **Algoritmo:** Extrai a sub-rede (ex: `192.168.1.`) e dispara até 254 requests simultâneos em blocos (`CONCURRENCY = 30`).
- **Timeout Rápido:** Cada IP possui um `AbortController` cravado em 800ms. Se atingir a porta 3333 e retornar o ping válido do `slave-estoque-server`, a rotina é quebrada e a URL conectada automaticamente.

---

## 4. Leitores de Câmera e Telas

### 4.1 Câmera de Códigos de Barras (`src/screens/BarcodeScanner.js`)
- **Renderização:** Utiliza `<CameraView style={styles.camera} facing="back" />` (flex: 1) renderizada em tela inteira sem uso restritivo de condicionais isFocused (mitigação de bug de tela branca).
- **Lógica de Buffer:** Cada leitura bem sucedida salva o equipamento no state `sessionScannedItems` (para evitar processamentos lentos).
- **Função `handleBarcodeScanned(data)`:** Faz o `split('/')` de dados escaneados, checa duplicatas em memória, valida status `EMPRESTADO` no SQLite e adiciona o objeto ao array de sessão.
- **Modais de Ação:**
  - `showListModal`: Modal verde para conferência final do buffer de bipagem.
  - `showSolicitanteModal`: Exibido para aprovar "Requisições Avulsas". Insere um `NOVA_REQUISICAO_AVULSA` no log.
  - `observacaoModalVisible`: Em modo `DEVOLUCAO`, permite preencher `hasAvaria` e `avariaDesc`.
- **Finalização `registrarAcaoOffline(eq, reqIdOverride)`:**
  1. Cria um ID Offline aleatório (`offline-XXXXX`) caso não haja no DB.
  2. Insere um log na `OfflineLog`.
  3. Atualiza `ItemRequisicao` (separacao=1 ou devolucao=1) e `Equipamento` (condição).

### 4.2 Câmera do Servidor (`src/screens/QRScanner.js`)
- Lida com a montagem da URL via QR Code. Usa o mesmo `<CameraView>` em full screen com fallback explícito em `backgroundColor: '#000'`.
- Possui a validação iterativa `for (const ip of result.ips)` para testar as portas ativas antes de confirmar.

### 4.3 Novo Equipamento (`src/screens/CadastrarEquipamento.js`)
- A tela gerencia os *States*: Nome, Patrimônio, Tipo (ID da FK Local), Categoria.
- **Captura Fotográfica:** Utiliza `expo-image-picker` (`launchCameraAsync` e `launchImageLibraryAsync`). O arquivo salvo em cache (URI `file://`) é injetado diretamente no JSON da ação offline para processamento multipart futuro do `api.js`.

---

## 5. Impressão Térmica (`src/services/printer.js`)

- Usa `expo-print` para gerar PDFs HTML e acionar o Spooler do Android.
- **`imprimirComprovante(requisicao, equipamentos, formato)`**: Gera a grade `table` do comprovante de entrega/devolução. Ajusta o viewport via `width: 302` para Bobinas 80mm e `219` para 58mm.
- **`imprimirEtiqueta(equipamento)`**: Utiliza `<script src=".../JsBarcode.all.min.js">` para gerar etiquetas Code-128 embarcadas dentro da Webview de impressão.

---

## 6. Configurações Compilatórias (Core Fixes)

- **`android:usesCleartextTraffic="true"`** (`AndroidManifest.xml`): É obrigatório para o APP (versões de produção) se comunicar com APIs rodando no padrão HTTP (Node.js/Express) em sub-redes corporativas. A ausência desta flag causa *Network Request Failed* instantâneo no Android 9+.
- Permissões inseridas: `android.permission.CAMERA`, `android.permission.INTERNET`, e `android.permission.READ_EXTERNAL_STORAGE`.

## 7. Como Rodar o Projeto

### Pré-requisitos
- Node.js (v18+) e NPM/Yarn
- App Expo Go instalado no celular (para testes rápidos) ou Android Studio / Emulador.
- A API (`slave-estoque-api`) deve estar rodando e acessível na mesma rede Wi-Fi.

### Instalação
1. Navegue até a pasta `slave-estoque-mobile`.
2. Instale as dependências:
   ```bash
   npm install
   ```

### Execução em Desenvolvimento
1. Inicie o servidor do Expo:
   ```bash
   npx expo start --clear
   ```
2. Escaneie o QR Code exibido no terminal utilizando o aplicativo Expo Go (no Android) ou a câmera padrão (no iOS) logado na mesma rede.

### Compilação de Produção (APK)
Para gerar o arquivo `.apk` final (Release) via Gradle localmente:
```bash
npm run build:apk
```
*O APK será salvo como `app-release.apk` no diretório configurado.*

---
*Fim do documento arquitetural. Utilize o texto acima como referência caso o aplicativo sofra regressões, bugs lógicos na finalização da compra ou erros de timeout no futuro.*
