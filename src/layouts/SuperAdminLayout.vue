<script setup lang="ts">
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const router = useRouter()

const LINKS = [
  { label: 'Resumen', icon: 'pi pi-chart-bar', routeName: 'sa-dashboard' },
  { label: 'Negocios', icon: 'pi pi-building', routeName: 'sa-businesses' },
  { label: 'Flujos', icon: 'pi pi-sitemap', routeName: 'sa-workflows' },
]

async function signOut(): Promise<void> {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <!-- Fondo oscuro a proposito: es la senal mas barata de "no estas en un
       negocio, estas en la plataforma". Confundir los dos paneles es como
       alguien termina cambiandole la configuracion al spa equivocado. -->
  <div class="flex min-h-screen bg-slate-900">
    <aside class="hidden w-56 flex-col border-r border-slate-800 md:flex">
      <div class="px-5 py-6">
        <span class="text-lg font-bold tracking-tight text-white">Nexolú</span>
        <span class="ml-1 text-lg font-light text-slate-400">Plataforma</span>
      </div>

      <nav class="flex flex-1 flex-col gap-1 px-3">
        <RouterLink
          v-for="link in LINKS"
          :key="link.routeName"
          :to="{ name: link.routeName }"
          class="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          active-class="bg-slate-800 font-medium text-white"
        >
          <i :class="link.icon" />
          <span>{{ link.label }}</span>
        </RouterLink>
      </nav>

      <div class="border-t border-slate-800 px-5 py-4">
        <p class="text-sm text-slate-300">{{ auth.user?.full_name }}</p>
        <button type="button" class="mt-2 text-xs text-slate-400 underline" @click="signOut">
          Cerrar sesión
        </button>
      </div>
    </aside>

    <main class="flex-1 overflow-x-auto bg-slate-50 md:m-2 md:rounded-lg">
      <slot />
    </main>
  </div>
</template>
