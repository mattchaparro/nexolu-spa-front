import axios from 'axios'

import router from '@/router'
import { useAuthStore } from '@/stores/auth.store'
import { useFlashStore } from '@/stores/flash.store'

import { tokenStorage } from './tokenStorage'

export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  // Sin timeout, una peticion que se queda colgada (wifi que cae justo al
  // volver de background, servidor caido) nunca resuelve ni rechaza - el
  // boton/pantalla que la disparo se queda "cargando" para siempre, sin
  // error visible y sin pasar por el interceptor de abajo (que solo actua
  // sobre respuestas que SI llegan). Bug reportado: "no me deja hacer click
  // en nada" tras volver de un rato inactivo - la app se veia trabada, no
  // deslogueada.
  timeout: 20_000,
  headers: {
    Accept: 'application/json',
  },
})

httpClient.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Antes de este interceptor, un 401 (token vencido, ver config/sanctum.php
// en la API - expira a las 4h) limpiaba la sesion y redirigia a /login en
// silencio: el usuario solo veia pantallas vacias hasta notar que estaba
// en el login otra vez, sin saber por que. Sanctum no maneja refresh
// tokens (son PATs planos) y este es un POS por turnos, no una app de
// sesion larga - visibilizar el 401 con un mensaje y volver a pedir
// credenciales es la solucion correcta, no vale la pena la complejidad de
// un refresh token para esto.
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const onLogin = router.currentRoute.value.name === 'login'

    if (status === 401 && !onLogin) {
      // clearSession() (no solo tokenStorage.clear()) es necesario: el guard
      // de router/index.ts redirige de vuelta a home si to.name === 'login'
      // y auth.isAuthenticated es true, e isAuthenticated se calcula del
      // token en memoria del store de Pinia, no de localStorage - limpiar
      // solo el storage dejaba el store todavia "autenticado" y el push a
      // login rebotaba de inmediato, sin sacar al usuario (bug reportado:
      // la alerta aparecia pero la app seguia navegable como logueado).
      useAuthStore().clearSession()
      useFlashStore().set('Tu sesión expiró. Inicia sesión de nuevo.', 'warn')
      router.push({ name: 'login' })
    } else if (status === 403 && !onLogin) {
      // El guard del router (ver router/index.ts) ya bloquea la mayoria de
      // estos casos antes de llegar aca, pero no cubre acciones dentro de
      // una pantalla ya cargada (ej. un permiso que el admin le quito al
      // empleado a mitad de turno) - sin esto esa pantalla se quedaba con
      // un error silencioso en la consola y nada visible para el usuario.
      const message = error.response?.data?.message ?? 'No tienes permiso para esta acción.'
      useFlashStore().set(message, 'error')
    }

    return Promise.reject(error)
  },
)
