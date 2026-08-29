import { QueryClient } from '@tanstack/vue-query'

// Defaults conservadores: los datos del POS cambian seguido (ventas,
// stock), asi que no asumimos que un fetch anterior sigue vigente por
// mucho tiempo. Cada modulo puede sobreescribir staleTime por query
// cuando el dato sea mas estable (ej. catalogo de productos).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})
