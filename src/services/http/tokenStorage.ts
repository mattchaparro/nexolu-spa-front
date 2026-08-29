const TOKEN_KEY = 'nexolu_auth_token'
// Token del super admin mientras impersona a otro usuario (ver
// ImpersonateController::start en la API - "volver" no es un endpoint,
// es dejar de usar el token de impersonacion) - guardarlo aparte permite
// restaurar la sesion original sin pedir contraseña de nuevo.
const IMPERSONATOR_TOKEN_KEY = 'nexolu_impersonator_token'

// Unica fuente de verdad del nombre de la llave en localStorage - el
// auth store la escribe, el interceptor de axios solo la lee.
export const tokenStorage = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => localStorage.removeItem(TOKEN_KEY),
  getImpersonator: (): string | null => localStorage.getItem(IMPERSONATOR_TOKEN_KEY),
  setImpersonator: (token: string): void => localStorage.setItem(IMPERSONATOR_TOKEN_KEY, token),
  clearImpersonator: (): void => localStorage.removeItem(IMPERSONATOR_TOKEN_KEY),
}

/**
 * Login SSO desde legacy (ver LoginController::authenticated() en
 * pos-saas): un negocio ya migrado (status completed) que hace login en
 * pos.nexolu.co recibe un token nuevo de nexolu-pos-api (mismas
 * credenciales, pedido server-to-server) y legacy redirige aca con
 * #token=... en el FRAGMENTO, nunca en query string - un fragmento no se
 * manda al servidor ni queda en logs de acceso/Referer.
 *
 * Guardarlo ahora, antes de que exista el store de Pinia, hace que
 * router.beforeEach lo trate exactamente igual que una recarga de pagina
 * con sesion existente (token en localStorage + user null ->
 * fetchCurrentUser(), ver ese guard) - no hace falta bootstrap especial
 * aparte de esto. Debe llamarse en main.ts, junto a
 * stashPendingWelcomeFromUrl() (mismo momento, mismo motivo).
 */
export function stashSsoTokenFromUrl(): void {
  try {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash
    if (!hash) {
      return
    }

    const token = new URLSearchParams(hash).get('token')
    if (token) {
      tokenStorage.set(token)
    }

    // Limpia el fragmento de la URL/historial - no dejar el token visible.
    history.replaceState(null, '', window.location.pathname + window.location.search)
  } catch {
    // localStorage/history pueden fallar (modo privado) - sin token
    // seguido simplemente cae al login normal, no rompe nada.
  }
}
