<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { redirectToSso, ssoError, ssoIsConfigured } from '@/services/http/ssoAssertion'
import { useAuthStore } from '@/stores/auth.store'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput } from '@/ui'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

/*
 * A dónde iba antes de que le pidieran la clave. Solo rutas de esta misma
 * aplicación: un `redirect` hacia otro dominio convertiría el login en un
 * trampolín para mandar a alguien a una página falsa con la sesión recién
 * abierta.
 */
const redirectTo = computed(() => {
  const value = route.query.redirect
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : null
})

/** Llegó desde Connect: se le dice para qué es esta clave. */
const vieneDeConnect = computed(() => redirectTo.value === '/abrir-connect')

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

/*
 * El correo y la contraseña van primero, siempre.
 *
 * Antes, con Nexolú configurado, el formulario arrancaba plegado detrás de
 * «Entrar con Nexolú». Pero las cuentas del equipo de los salones --Marcela,
 * Alejandra-- viven aquí, con su correo y su clave: el botón de Nexolú no
 * las conoce, y tocarlo las dejaba en una pantalla que no les servía. Nexolú
 * queda debajo, como segunda opción.
 */
const ssoAvailable = ssoIsConfigured()

// `ssoError` lo pone el guard del router cuando un canje falla. Se muestra
// junto con el formulario y NO se reintenta el SSO solo: un 403 volveria a
// fallar igual y el usuario quedaria en un bucle sin ver nunca este mensaje.
const displayError = computed(() => error.value ?? ssoError.value)

function entrarConNexolu(): void {
  error.value = null
  ssoError.value = null
  try {
    redirectToSso(redirectTo.value ?? undefined)
  } catch {
    error.value = 'El acceso con Nexolú no está configurado en esta instalación.'
  }
}

async function submit(): Promise<void> {
  error.value = null
  ssoError.value = null
  loading.value = true

  try {
    await auth.login({
      email: email.value,
      password: password.value,
      // Identifica el token en la lista de sesiones: cerrar sesion en el
      // celular no deberia cerrarla en la tablet del mostrador.
      device_name: navigator.userAgent.slice(0, 100),
    })
    /*
     * A la raíz, que decide a dónde según el rol (ver el router): quien
     * atiende entra a SU día y quien coordina, a la agenda del negocio.
     * Mandar a todo el mundo a `agenda` dejaba a una manicurista mirando
     * las citas de todas para buscar las suyas.
     */
    await router.push(redirectTo.value ?? '/')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos iniciar sesión. Revisa tus datos.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <h1 class="text-lg font-semibold text-slate-800">Entrar</h1>
      <p class="mt-1 text-sm text-slate-500">
        {{
          vieneDeConnect
            ? 'Entra con tu cuenta del Spa para abrir el chat de WhatsApp.'
            : 'Gestiona la agenda de tu negocio.'
        }}
      </p>
    </div>

    <p v-if="displayError" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ displayError }}
    </p>

    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <NxInput
        v-model="email"
        type="email"
        label="Correo"
        autocomplete="username"
        required
        :disabled="loading"
      />

      <NxInput
        v-model="password"
        type="password"
        label="Contraseña"
        autocomplete="current-password"
        required
        :disabled="loading"
      />

      <NxButton type="submit" :loading="loading">Entrar</NxButton>
    </form>

    <template v-if="ssoAvailable">
      <div class="flex items-center gap-3 text-xs text-slate-400">
        <span class="h-px flex-1 bg-slate-200" />
        o
        <span class="h-px flex-1 bg-slate-200" />
      </div>

      <NxButton type="button" variant="secondary" :disabled="loading" @click="entrarConNexolu">
        Entrar con Nexolú
      </NxButton>
    </template>
  </div>
</template>
