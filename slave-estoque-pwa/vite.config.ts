// @ts-ignore
import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-ignore
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl(), // gera certificado auto-assinado para HTTPS
  ],
  server: {
    host: true,        // escuta em 0.0.0.0 — todos os IPs da máquina
    port: 5173,        // HTTPS na porta 5173
    strictPort: false, // tenta próxima porta disponível se ocupada
    // @ts-ignore
    https: true,       // habilita HTTPS com certificado auto-assinado
  },
  resolve: {
    alias: {
      // @ts-ignore
      "@": path.resolve(__dirname, "./src"),
    },
  },
})

