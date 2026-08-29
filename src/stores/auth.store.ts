import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { httpClient } from '@/services/http/client'
import { tokenStorage } from '@/services/http/tokenStorage'
import { queryClient } from '@/services/query/queryClient'
import type { AuthResponse, LoginCredentials, User } from '@/types/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(tokenStorage.get())
  /** El token de plataforma mientras se está viendo el panel de un negocio. */
  const impersonatorToken = ref<string | null>(tokenStorage.getImpersonator())

  const isAuthenticated = computed(() => Boolean(token.value))
  const business = computed(() => user.value?.business ?? null)
  /** Propiedad del usuario, no permiso del negocio: no se hereda de un rol. */
  const isSuperAdmin = computed(() => user.value?.is_super_admin === true)
  const isImpersonating = computed(() => Boolean(impersonatorToken.value))

  /**
   * Los queryKey no estan scopeados por negocio: son el mismo cache en memoria
   * durante toda la vida de la SPA. Limpiarlo en cada cambio de identidad
   * evita que datos de un negocio sobrevivan al siguiente.
   */
  function setSession(data: AuthResponse): void {
    queryClient.clear()
    token.value = data.token
    user.value = data.user
    tokenStorage.set(data.token)
  }

  function clearSession(): void {
    queryClient.clear()
    token.value = null
    user.value = null
    impersonatorToken.value = null
    tokenStorage.clear()
    // Tambien el de plataforma: cerrar sesion desde un negocio impersonado no
    // puede dejar un token de superadmin colgado en el navegador.
    tokenStorage.clearImpersonator()
  }

  async function login(credentials: LoginCredentials): Promise<void> {
    const { data } = await httpClient.post<AuthResponse>('/login', credentials)
    setSession(data)
  }

  async function logout(): Promise<void> {
    try {
      await httpClient.post('/logout')
    } catch {
      // Si el token ya vencio del lado del servidor, cerrar sesion localmente
      // sigue siendo lo correcto.
    }

    clearSession()
  }

  async function fetchCurrentUser(): Promise<void> {
    const { data } = await httpClient.get<User>('/me')
    user.value = data
  }

  /**
   * Permiso concreto del usuario. La misma fuente que usa el guard del router
   * y el menu, para que lo que se ve y lo que el backend acepta no diverjan.
   */
  function can(permission: string): boolean {
    return user.value?.permissions?.includes(permission) ?? false
  }

  /** Bandera ya resuelta por el backend. Nunca se resuelve aca. */
  function hasFeature(feature: string): boolean {
    return business.value?.resolved_features?.[feature] === true
  }

  /*
   * "Entrar como" un usuario de un negocio, para soporte.
   *
   * En una API sin sesion no hay nada que cambiar: el backend devuelve un
   * token nuevo a nombre de esa persona. Impersonar es guardar el del
   * superadmin aparte y adoptar el nuevo como si fuera un login normal.
   */
  function impersonate(data: AuthResponse): void {
    if (token.value) {
      impersonatorToken.value = token.value
      tokenStorage.setImpersonator(token.value)
    }

    setSession(data)
  }

  /** Vuelve a la sesion de plataforma sin pedir contraseña de nuevo. */
  async function stopImpersonating(): Promise<void> {
    const original = impersonatorToken.value

    if (!original) {
      return
    }

    try {
      // No hay endpoint para "volver": salir es cerrar la sesion prestada,
      // que revoca ese token del lado del servidor.
      await httpClient.post('/logout')
    } catch {
      // El token prestado puede haber vencido. No bloquea volver.
    }

    queryClient.clear()
    impersonatorToken.value = null
    tokenStorage.clearImpersonator()
    token.value = original
    tokenStorage.set(original)
    // Se descarta el usuario en memoria y se vuelve a pedir: es lo que
    // distingue "volvi a ser yo" de "sigo viendo la pantalla del otro".
    user.value = null
    await fetchCurrentUser()
  }

  return {
    user,
    token,
    business,
    isAuthenticated,
    isSuperAdmin,
    isImpersonating,
    login,
    logout,
    fetchCurrentUser,
    clearSession,
    impersonate,
    stopImpersonating,
    can,
    hasFeature,
  }
})
