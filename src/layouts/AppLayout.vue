<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useNavItems } from '@/composables/useNavItems'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const router = useRouter()
const { navItems } = useNavItems()

const returning = ref(false)

async function signOut(): Promise<void> {
  await auth.logout()
  await router.push({ name: 'login' })
}

/** Volver a plataforma sin pedir contraseña de nuevo. */
async function backToPlatform(): Promise<void> {
  returning.value = true

  try {
    await auth.stopImpersonating()
    await router.push({ name: 'sa-businesses' })
  } finally {
    returning.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-slate-50">
    <!-- Franja de impersonación.
         Ámbar y a todo lo ancho a propósito: la señal más barata de "esto que
         estás viendo no es tuyo". Sin ella, alguien de soporte cambia un
         precio creyendo que está en su propia pantalla. -->
    <div
      v-if="auth.isImpersonating"
      class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-2 text-sm font-medium text-white"
    >
      <i class="pi pi-eye" />
      <span>
        Estás viendo <b>{{ auth.business?.name ?? 'este negocio' }}</b> como
        {{ auth.user?.full_name ?? 'otro usuario' }}
      </span>
      <button
        type="button"
        class="rounded-md bg-white/20 px-2.5 py-1 font-semibold hover:bg-white/30 disabled:opacity-60"
        :disabled="returning"
        @click="backToPlatform"
      >
        {{ returning ? 'Volviendo…' : 'Volver a plataforma' }}
      </button>
    </div>

    <div class="flex min-h-0 flex-1">
      <aside class="hidden w-60 flex-col border-r border-slate-200 bg-white md:flex">
        <div class="px-5 py-6">
          <span class="text-lg font-bold tracking-tight text-indigo-600">Nexolú</span>
          <span class="ml-1 text-lg font-light text-slate-500">Spa</span>
        </div>

        <nav class="flex flex-1 flex-col gap-1 px-3">
          <RouterLink
            v-for="item in navItems"
            :key="item.label"
            :to="{ name: item.routeName }"
            class="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            active-class="bg-indigo-50 font-medium text-indigo-700"
          >
            <i :class="item.icon" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </nav>

        <div class="border-t border-slate-200 px-5 py-4">
          <p class="text-sm font-medium text-slate-700">{{ auth.user?.full_name }}</p>
          <p class="text-xs text-slate-500">{{ auth.business?.name }}</p>
          <button
            v-if="auth.isImpersonating"
            type="button"
            class="mt-3 text-xs text-amber-700 underline"
            :disabled="returning"
            @click="backToPlatform"
          >
            Volver a plataforma
          </button>
          <button v-else type="button" class="mt-3 text-xs text-slate-500 underline" @click="signOut">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main class="flex-1 overflow-x-auto">
        <slot />
      </main>
    </div>
  </div>
</template>
