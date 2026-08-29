import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { httpClient } from '@/services/http/client'
import { tokenStorage } from '@/services/http/tokenStorage'
import { queryClient } from '@/services/query/queryClient'
import type { AuthResponse, LoginCredentials, User } from '@/types/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(tokenStorage.get())

  const isAuthenticated = computed(() => Boolean(token.value))
  const business = computed(() => user.value?.business ?? null)
  /** Propiedad del usuario, no permiso del negocio: no se hereda de un rol. */
  const isSuperAdmin = computed(() => user.value?.is_super_admin === true)

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
    tokenStorage.clear()
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

  return {
    user,
    token,
    business,
    isAuthenticated,
    isSuperAdmin,
    login,
    logout,
    fetchCurrentUser,
    clearSession,
    can,
    hasFeature,
  }
})
