import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    allowedHosts: true,
    // Fijo, no el 5173 por defecto: ese lo usa nexolu-pos-front y el 5174
    // nexolu-admin-front. Sin fijarlo, Vite salta al siguiente libre y la
    // URL cambia entre arranques, rompiendo CORS y SANCTUM_STATEFUL_DOMAINS
    // del backend.
    port: 5273,
    strictPort: true,
  },
})
