# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```

## Atualizações Recentes: Autenticação Offline-First e Sync de Imagens

1. **Autenticação Segura de Sincronização**: O servidor (API) e o PWA passaram a exigir uma Palavra-Passe para liberação do acesso e sincronismo, usando o cabeçalho x-sync-password.
2. **Descoberta Inteligente (Mobile)**: O App Mobile implementou uma camada de discovery aprimorada que tenta o ping portando a senha salva offline. Erros 401 Unauthorized bloqueiam o handshake adequadamente, abrindo o modal visual pedindo a senha.
3. **Resiliência de Teclado**: O aplicativo móvel recebeu tratamento via KeyboardAvoidingView no modal da Home e do Leitor de QRCode para evitar que o teclado nativo encubra os inputs em dispositivos menores.
4. **Cache Físico de Imagens (Offline Completo)**: O motor de sincronização (syncPull) do Mobile foi recriado para baixar via expo-file-system as miniaturas do servidor, reescrevendo o banco de dados interno com a URL local ile:///.... Isso tornou o acesso ao Acervo 100% independente de internet após a Sincronização.
