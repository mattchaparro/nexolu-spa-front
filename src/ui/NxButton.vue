<script setup lang="ts">
import { computed } from 'vue'
import PrimeButton from 'primevue/button'

export type NxButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dark'
export type NxButtonSize = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: NxButtonVariant
    size?: NxButtonSize
    loading?: boolean
    disabled?: boolean
    icon?: string
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: 'primary',
    size: 'md',
    loading: false,
    disabled: false,
    icon: undefined,
    type: 'button',
  },
)

// Cada variante tiene un unico significado fijo en toda la app - nunca
// elegir color "porque combina" en una pantalla puntual. `danger` es
// exclusivo para acciones destructivas (eliminar, cancelar algo
// irreversible), nunca un color alternativo para "otro boton mas". `dark`
// (severity "contrast" de PrimeVue: fondo negro/surface.950 en modo claro)
// es para la accion secundaria de una pantalla que tiene una primaria
// (indigo) al lado - ej. "Agregar a la cuenta" junto a "Cobrar" - nunca un
// segundo indigo compitiendo por atencion con el primario. El color en si
// (indigo, slate, negro, rojo) lo pone el tema de PrimeVue
// (theme/nexoluPreset.ts) via severity - no Tailwind a mano.
const severity = computed<'primary' | 'secondary' | 'danger' | 'contrast'>(() => {
  if (props.variant === 'danger') {
    return 'danger'
  }
  if (props.variant === 'primary') {
    return 'primary'
  }
  if (props.variant === 'dark') {
    return 'contrast'
  }
  return 'secondary'
})

const outlined = computed(() => props.variant === 'outline')
const text = computed(() => props.variant === 'ghost')

// PrimeVue inyecta `.p-button-outlined { background: transparent }` en un
// <style> propio en tiempo de ejecucion, DESPUES de que carga la hoja de
// Tailwind - a igual especificidad (una sola clase de cada lado), gana el
// que aparece despues en el documento, asi que una clase Tailwind normal
// (ej. bg-white) nunca le gana (confirmado con getComputedStyle: la clase
// quedaba en el DOM pero el fondo seguia transparent). Mismo tipo de
// problema que el font-size de `.pi` (ver CatalogView) - la unica forma
// confiable de ganarle es un estilo inline, que SIEMPRE le gana a
// cualquier regla de hoja de estilos sin `!important`.
const outlineBackgroundStyle = computed(() => (props.variant === 'outline' ? { backgroundColor: '#ffffff' } : undefined))

// PrimeVue solo tiene "small"/"large" nativos - "md" es su tamaño por
// defecto (undefined).
const primeSize = computed<'small' | 'large' | undefined>(() => {
  if (props.size === 'sm') {
    return 'small'
  }
  if (props.size === 'lg') {
    return 'large'
  }
  return undefined
})
</script>

<template>
  <!--
    Icon prop y el slot de loading nativos de PrimeButton no se usan: su
    fallback (icono/spinner) solo se renderiza cuando el slot default esta
    vacio, y NxButton siempre lo llena con el texto del boton. Pasarle
    :icon ademas rompe el tamaño (PrimeVue marca "icon-only" con solo
    chequear la prop icon + la prop label, sin mirar el slot - ver
    node_modules/primevue/button/index.mjs hasIcon/icon-only), asi que el
    icono y el spinner se pintan a mano aca en vez de delegarselos.
  -->
  <PrimeButton
    :severity="severity"
    :outlined="outlined"
    :text="text"
    :size="primeSize"
    :loading="loading"
    :disabled="disabled || loading"
    :type="type"
    :style="outlineBackgroundStyle"
  >
    <i v-if="loading" class="pi pi-spinner pi-spin" aria-hidden="true" />
    <i v-else-if="icon" :class="icon" aria-hidden="true" />
    <slot />
  </PrimeButton>
</template>
