---
trigger: always_on
---

# 🛡️ FAP Estoque - Protocolo de Preservação e Isolamento

> **MANDATÓRIO:** Você DEVE consultar e obedecer a estas regras ANTES de planejar ou fazer qualquer modificação de código neste workspace.

## 1. Princípio do Isolamento Estrito
Qualquer alteração solicitada pelo usuário deve ser rigidamente confinada ao seu respectivo domínio. Extrapolar escopos é proibido.
- **Painel:** Se o pedido for sobre o "Painel", altere EXCLUSIVAMENTE os arquivos dentro de `slave-estoque-pwa`.
- **Servidor/API:** Se o pedido for sobre o "Servidor" ou backend, altere EXCLUSIVAMENTE arquivos dentro de `slave-estoque-api`.

## 2. Protocolo de Alteração do Mobile (App/APK)
Alterações no aplicativo coletor mobile têm risco crítico de quebrar o fluxo Offline-First nas docas/estoque.
- **OBRIGAÇÃO DE AVISO:** Se uma tarefa exigir, por consequência, mudar *qualquer coisa* no app (`slave-estoque-mobile`), **PARE**. Você deve primeiro informar detalhadamente ao usuário O QUE vai ser modificado no app.
- Você só deve modificar o app após a validação e consentimento explícito do usuário para aquela mudança específica.

## 3. Imutabilidade da Estrutura de Conexão
A infraestrutura de comunicação em rede (offline-sync, handshake via QR Code, porta 3333, proxy do instalador FAP) é o alicerce do projeto.
- É **TERMINANTEMENTE PROIBIDO** quebrar, remover ou refatorar de forma destrutiva a estrutura de conexão atual.
- Ao adicionar novas features, as rotas de sincronização, autenticação e comunicação já existentes devem permanecer intactas e funcionais.
