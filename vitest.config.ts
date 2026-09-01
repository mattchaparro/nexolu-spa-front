import { fileURLToPath } from 'node:url'

import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

/*
 * Configuración de pruebas, separada de la de Vite.
 *
 * Hereda plugins y alias con `mergeConfig` en vez de repetirlos: dos listas de
 * alias que hay que mantener sincronizadas terminan divergiendo, y el síntoma
 * es una prueba que pasa importando algo distinto de lo que importa la app.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // jsdom y no node: la mitad de lo que vale la pena probar acá toca el
      // DOM -- montar un componente, leer localStorage, armar un FormData.
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.spec.ts'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
