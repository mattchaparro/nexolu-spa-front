<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { redirectToSso, ssoError, ssoIsConfigured } from '@/services/http/ssoAssertion'
import { useAuthStore } from '@/stores/auth.store'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput } from '@/ui'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

const ssoAvailable = ssoIsConfigured()
// El formulario arranca plegado cuando hay SSO: es la clave de emergencia,
// no el camino de todos los dias. Sin SSO configurado se muestra desplegado,
// porque entonces es la unica forma de entrar.
const showBreakGlass = ref(!ssoAvailable)

// `ssoError` lo pone el guard del router cuando un canje falla. Se muestra
// junto con el formulario y NO se reintenta el SSO solo: un 403 volveria a
// fallar igual y el usuario quedaria en un bucle sin ver nunca este mensaje.
const displayError = computed(() => error.value ?? ssoError.value)
const breakGlassVisible = computed(() => showBreakGlass.value || Boolean(ssoError.value))

function entrarConNexolu(): void {
  error.value = null
  ssoError.value = null
  try {
    redirectToSso()
  } catch {
    error.value = 'El acceso con Nexolú no está configurado en esta instalación.'
    showBreakGlass.value = true
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
    await router.push({ name: 'agenda' })
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
      <p class="mt-1 text-sm text-slate-500">Gestiona la agenda de tu negocio.</p>
    </div>

    <p v-if="displayError" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ displayError }}
    </p>

    <template v-if="ssoAvailable">
      <NxButton type="button" @click="entrarConNexolu">Entrar con Nexolú</NxButton>

      <button
        v-if="!breakGlassVisible"
        type="button"
        class="text-sm text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
        @click="showBreakGlass = true"
      >
        Entrar con correo y contraseña
      </button>
    </template>

    <form
      v-show="breakGlassVisible"
      class="flex flex-col gap-4"
      :class="{ 'mt-2 border-t border-slate-200 pt-4': ssoAvailable }"
      @submit.prevent="submit"
    >
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
  </div>
</template>
