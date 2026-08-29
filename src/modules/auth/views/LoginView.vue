<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth.store'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput } from '@/ui'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

async function submit(): Promise<void> {
  error.value = null
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
  <form class="flex flex-col gap-4" @submit.prevent="submit">
    <div>
      <h1 class="text-lg font-semibold text-slate-800">Entrar</h1>
      <p class="mt-1 text-sm text-slate-500">Gestiona la agenda de tu negocio.</p>
    </div>

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

    <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ error }}
    </p>

    <NxButton type="submit" :loading="loading">Entrar</NxButton>
  </form>
</template>
