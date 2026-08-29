<script setup lang="ts">
import { useRouter } from 'vue-router'

import { useNavItems } from '@/composables/useNavItems'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const router = useRouter()
const { navItems } = useNavItems()

async function signOut(): Promise<void> {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="flex min-h-screen bg-slate-50">
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
        <button type="button" class="mt-3 text-xs text-slate-500 underline" @click="signOut">
          Cerrar sesión
        </button>
      </div>
    </aside>

    <main class="flex-1 overflow-x-auto">
      <slot />
    </main>
  </div>
</template>
