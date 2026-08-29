<script setup lang="ts">
// Barra superior, calcada de Components/NavBarProfile.vue del legacy
// (mismo fondo indigo-900, mismo lugar para nombre + salir, mismo logo
// -ApplicationMark- en la esquina movil). A pedido explicito, el nombre +
// boton de salir sueltos pasan a un dropdown con avatar de iniciales
// (mismo patron que usa Admin/Users/Index.vue del legacy para el avatar de
// cada usuario en la lista) - agrupa "Mi perfil", "Ajustes" y "Mi
// suscripcion" (antes sueltos en el menu lateral) junto con "Salir".
//
// Dropdown hecho a mano (no primevue/menu) a proposito, mismo criterio que
// el resto de este archivo: los componentes de PrimeVue estan pensados
// para fondo claro, y forzarlos a la barra oscura pelea con sus propias
// utilidades internas sin garantia de quien gana la especificidad CSS.
import { computed, ref, useTemplateRef } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { RouterLink } from 'vue-router'

const props = withDefaults(
  defineProps<{
    logo: string
    userName: string
    /** Mostrar "Mi perfil" en el dropdown - la pantalla existe para cualquier usuario autenticado. */
    showProfileLink?: boolean
    /** Mostrar "Ajustes" - solo tiene sentido para quien administra el negocio. */
    showSettingsLink?: boolean
    /** Mostrar "Mi suscripción" - idem, solo admin. */
    showSubscriptionLink?: boolean
  }>(),
  {
    showProfileLink: false,
    showSettingsLink: false,
    showSubscriptionLink: false,
  },
)

const emit = defineEmits<{ logout: [] }>()

const menuOpen = ref(false)
const menuRef = useTemplateRef<HTMLElement>('menuRef')
onClickOutside(menuRef, () => {
  menuOpen.value = false
})

function closeMenu(): void {
  menuOpen.value = false
}

function handleLogout(): void {
  closeMenu()
  emit('logout')
}

// "Mateo Chaparro" -> "MC", "Mateo" -> "MA", vacio -> "?" (usuario nuevo
// sin nombre cargado aun, no deberia pasar pero evita un avatar en blanco).
const initials = computed(() => {
  const parts = props.userName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return '?'
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[1][0]).toUpperCase()
})
</script>

<template>
  <header class="flex h-16 items-center justify-between bg-indigo-900 px-4 sm:px-6">
    <img :src="logo" alt="Nexolú POS" class="h-9 w-auto rounded-lg bg-white px-2 py-1 lg:hidden" />
    <div class="ml-auto flex items-center gap-3">
      <slot name="actions" />

      <div ref="menuRef" class="relative">
        <button
          type="button"
          class="flex items-center gap-2 rounded-lg py-1 pl-2 pr-1.5 transition-colors hover:bg-white/10"
          :aria-expanded="menuOpen"
          aria-haspopup="true"
          @click="menuOpen = !menuOpen"
        >
          <span class="hidden text-sm text-white/80 sm:inline">{{ userName }}</span>
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
            {{ initials }}
          </span>
          <i class="pi pi-angle-down text-xs text-white/70" />
        </button>

        <div
          v-if="menuOpen"
          class="absolute right-0 top-full z-30 mt-2 w-56 rounded-lg border border-slate-200 bg-white py-1.5 text-slate-700 shadow-lg"
        >
          <RouterLink
            v-if="showProfileLink"
            :to="{ name: 'profile.index' }"
            class="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-slate-50"
            @click="closeMenu"
          >
            <i class="pi pi-user w-4 text-slate-400" />
            Mi perfil
          </RouterLink>
          <RouterLink
            v-if="showSettingsLink"
            :to="{ name: 'business-settings.index' }"
            class="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-slate-50"
            @click="closeMenu"
          >
            <i class="pi pi-cog w-4 text-slate-400" />
            Ajustes
          </RouterLink>
          <RouterLink
            v-if="showSubscriptionLink"
            :to="{ name: 'subscription.index' }"
            class="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-slate-50"
            @click="closeMenu"
          >
            <i class="pi pi-credit-card w-4 text-slate-400" />
            Mi suscripción
          </RouterLink>

          <div v-if="showProfileLink || showSettingsLink || showSubscriptionLink" class="my-1.5 border-t border-slate-100" />

          <button type="button" class="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50" @click="handleLogout">
            <i class="pi pi-sign-out w-4" />
            Salir
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
