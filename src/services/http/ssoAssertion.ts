import { ref } from 'vue'

// Recoge la asercion que nexolu-auth deja en el fragmento de la URL al
// volver, y guarda la ruta pretendida antes de irse.
//
// El parametro se llama `auth_token` y NO `token`: este mismo repo tiene un
// `stashSsoTokenFromUrl()` vivo en main.ts que lee `#token=` (el SSO del
// monolito legacy, ver tokenStorage.ts) y lo guarda como si fuera un PAT de
// Sanctum. Compartir el nombre haria que ese helper se comiera la asercion
// y todas las peticiones dieran 401 sin causa visible en ningun lado.
const FRAGMENT_PARAM = 'auth_token'

// El slug con el que esta app se identifica ante nexolu-auth. Tiene que
// coincidir con una clave de AUTH_PRODUCTS_JSON alla.
const PRODUCT = 'nexolu-spa-api'

// sessionStorage y no localStorage: la asercion vive 120 s y se gasta al
// cargar la pagina. No tiene por que sobrevivir a cerrar la pestana ni
// filtrarse a otras.
const ASSERTION_KEY = 'nexolu_sso_assertion'
const PENDING_ROUTE_KEY = 'nexolu_sso_pending_route'

function take(key: string): string | null {
  const value = sessionStorage.getItem(key)
  if (value !== null) sessionStorage.removeItem(key)
  return value
}

/**
 * Motivo por el que fallo el ultimo canje, para que LoginView lo muestre.
 *
 * Un `ref` y no sessionStorage: cuando el canje falla ya estabamos
 * navegando hacia la pantalla de login, asi que esa vista puede no volver a
 * montarse. Un valor que solo se leyera en `onMounted` se perderia en
 * silencio, justo en el caso en el que el usuario mas necesita el mensaje.
 */
export const ssoError = ref<string | null>(null)

/**
 * Corre en main.ts ANTES de montar la app, al lado de
 * `stashSsoTokenFromUrl()` y sin alterar su orden (el SSO de legacy sigue
 * vivo).
 *
 * Tiene que ser antes de que arranque el router: la primera navegacion
 * descarta el fragmento, asi que un guard ya llegaria tarde.
 */
export function stashSsoAssertionFromUrl(): void {
  try {
    const hash = window.location.hash
    if (!hash.startsWith(`#${FRAGMENT_PARAM}=`)) return

    const assertion = new URLSearchParams(hash.slice(1)).get(FRAGMENT_PARAM)
    if (!assertion) return

    sessionStorage.setItem(ASSERTION_KEY, assertion)

    // Sacar la asercion de la barra de direcciones para que no quede en el
    // historial ni se comparta al copiar la URL.
    history.replaceState(null, '', window.location.pathname + window.location.search)
  } catch {
    // sessionStorage/history pueden fallar (modo privado): sin asercion se
    // cae al login normal, no rompe nada.
  }
}

export const ssoAssertion = {
  take: (): string | null => take(ASSERTION_KEY),
  takePendingRoute: (): string | null => take(PENDING_ROUTE_KEY),
}

export function ssoIsConfigured(): boolean {
  return Boolean(import.meta.env.VITE_AUTH_BASE_URL)
}

/**
 * Manda el navegador a la pantalla de nexolu-auth.
 *
 * Solo va `product` en el query: el destino de vuelta lo decide
 * nexolu-auth desde su propia config, nunca esta URL. Por eso un open
 * redirect no es algo que haya que filtrar aca, es imposible. La ruta
 * pretendida se guarda de este lado y nunca sale de este origen.
 */
export function redirectToSso(pendingRoute?: string): void {
  const base = import.meta.env.VITE_AUTH_BASE_URL

  if (!base) {
    throw new Error('Falta VITE_AUTH_BASE_URL: el acceso con Nexolu no esta configurado.')
  }

  if (pendingRoute) sessionStorage.setItem(PENDING_ROUTE_KEY, pendingRoute)

  window.location.assign(`${base}/login?product=${PRODUCT}`)
}
