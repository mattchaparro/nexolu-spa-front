<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useNavItems } from '@/composables/useNavItems'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { navItems } = useNavItems()

const returning = ref(false)
const drawerOpen = ref(false)

/*
 * En móvil la barra de abajo lleva CUATRO cosas y el resto va al cajón.
 *
 * Cinco iconos de 44px no caben con etiqueta legible en un teléfono angosto,
 * y una barra donde no se lee qué es cada cosa no es navegación, es adivinanza.
 */
const bottomItems = computed(() => navItems.value.slice(0, 4))
const drawerItems = computed(() => navItems.value.slice(4))

// Navegar cierra el cajón. Sin esto queda abierto encima de la pantalla nueva.
watch(() => route.fullPath, () => { drawerOpen.value = false })

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

    <!-- Encabezado móvil: marca y negocio, NO la sección.
         La sección ya la dicen el título de la pantalla y la pestaña activa de
         abajo; repetirla aquí gastaba 50px de alto en un teléfono para decir
         "Agenda" encima de un `<h1>` que dice "Agenda". -->
    <header
      class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 md:hidden"
    >
      <span class="text-sm font-bold tracking-tight text-indigo-600">
        Nexolú <span class="font-light text-slate-500">Spa</span>
      </span>
      <span class="truncate text-xs text-slate-500">{{ auth.business?.name }}</span>
    </header>

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

      <!-- El padding de abajo deja respirar la última fila por encima de la
           barra fija; sin él, el botón de guardar queda debajo del menú. -->
      <main class="min-w-0 flex-1 overflow-x-auto pb-20 md:pb-0">
        <slot />
      </main>
    </div>

    <!-- Cajón con el resto del menú -->
    <Teleport to="body">
      <div v-if="drawerOpen" class="fixed inset-0 z-40 md:hidden">
        <div class="absolute inset-0 bg-slate-900/40" @click="drawerOpen = false" />

        <nav
          class="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white pb-20"
        >
          <div class="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
            <span class="font-semibold text-slate-800">Menú</span>
            <button type="button" class="text-slate-400" @click="drawerOpen = false">
              <i class="pi pi-times" />
            </button>
          </div>

          <RouterLink
            v-for="item in drawerItems"
            :key="item.label"
            :to="{ name: item.routeName }"
            class="flex items-center gap-3 border-b border-slate-50 px-5 py-3.5 text-slate-700"
            active-class="bg-indigo-50 font-medium text-indigo-700"
          >
            <i :class="item.icon" class="w-5 text-slate-400" />
            <span>{{ item.label }}</span>
          </RouterLink>

          <div class="px-5 py-4">
            <p class="text-sm font-medium text-slate-700">{{ auth.user?.full_name }}</p>
            <p class="text-xs text-slate-500">{{ auth.business?.name }}</p>
            <button
              v-if="auth.isImpersonating"
              type="button"
              class="mt-3 text-sm text-amber-700 underline"
              :disabled="returning"
              @click="backToPlatform"
            >
              Volver a plataforma
            </button>
            <button v-else type="button" class="mt-3 text-sm text-slate-500 underline" @click="signOut">
              Cerrar sesión
            </button>
          </div>
        </nav>
      </div>
    </Teleport>

    <!-- Barra inferior. Fija, con área táctil de 44px y respetando el borde
         inferior del iPhone (`env(safe-area-inset-bottom)`); sin eso el último
         icono queda debajo de la barra del sistema y no se puede tocar. -->
    <nav
      class="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white md:hidden"
      :style="{ paddingBottom: 'env(safe-area-inset-bottom)' }"
    >
      <RouterLink
        v-for="item in bottomItems"
        :key="item.label"
        :to="{ name: item.routeName }"
        class="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-slate-500"
        active-class="text-indigo-600"
      >
        <i :class="item.icon" class="text-lg" />
        <span class="max-w-full truncate px-1">{{ item.label }}</span>
      </RouterLink>

      <button
        v-if="drawerItems.length"
        type="button"
        class="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[11px]"
        :class="drawerOpen ? 'text-indigo-600' : 'text-slate-500'"
        @click="drawerOpen = !drawerOpen"
      >
        <i class="pi pi-bars text-lg" />
        <span>Más</span>
      </button>
    </nav>
  </div>
</template>
