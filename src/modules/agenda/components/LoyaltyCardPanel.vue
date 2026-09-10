<script setup lang="ts">
import { computed } from 'vue'

import type { LoyaltyCard } from '@/modules/settings/composables/useLoyalty'

/*
|------------------------------------------------------------------------------
| La tarjeta de la clienta, dibujada
|------------------------------------------------------------------------------
| El backend manda la escalera completa -- cada hito, cuáles alcanzó y cuáles
| ya cobró -- y la pantalla de cobro la resumía en un renglón: "22 de 25 sellos
| · le faltan 3". Peor: cuando había un premio disponible, ese renglón
| DESAPARECÍA, así que justo en el cobro donde más sirve saberlo, no se veía ni
| cuántos sellos tiene ni qué viene después.
|
| Lo que hace volver a una clienta no es el premio que ya ganó: es ver que a
| los 30 hay un producto. Eso sólo funciona si quien cobra lo tiene delante
| para decírselo en voz alta.
*/

const props = defineProps<{ card: LoyaltyCard }>()

const programa = computed(() => props.card.program)
const escalones = computed(() => props.card.tiers ?? [])
const esEscalera = computed(() => programa.value?.mode === 'ladder' && escalones.value.length > 0)

/** El último hito manda la escala del riel; en tarjeta simple, el total. */
const tope = computed(() =>
  esEscalera.value
    ? (escalones.value.at(-1)?.stamps_required ?? props.card.stamps)
    : (programa.value?.stamps_required ?? 0),
)

/** Los puntitos de la tarjeta simple: uno por sello, llenos los ganados. */
const puntos = computed(() =>
  Array.from({ length: tope.value }, (_, i) => i < props.card.stamps),
)

/*
 * Con más de 14 sellos los puntitos dejan de leerse y se convierten en una
 * mancha. A partir de ahí el riel dice lo mismo ocupando menos.
 */
const dibujaPuntos = computed(() => !esEscalera.value && tope.value > 0 && tope.value <= 14)

function porcentaje(sellos: number): number {
  return tope.value === 0 ? 0 : Math.min(100, (sellos / tope.value) * 100)
}

const avance = computed(() => porcentaje(props.card.stamps))

/** Lo que viene DESPUÉS del siguiente: es el que hace volver, no el próximo. */
const masAdelante = computed(() => {
  const pendientes = escalones.value.filter((t) => !t.reached)

  return pendientes.length > 1 ? pendientes[1] : null
})

/*
 * El premio de un regalo se escribe como frase suelta ("Recibe un producto de
 * nuestra marca al azar.") y ya trae su punto. La plantilla pone el suyo, y
 * los dos juntos daban "al azar..".
 */
function sinPuntoFinal(texto: string): string {
  return texto.trim().replace(/\.$/, '')
}
</script>

<template>
  <div v-if="programa" class="rounded-md border border-slate-200 px-4 py-3">
    <div class="flex items-baseline justify-between gap-3">
      <p class="text-sm font-medium text-slate-700">{{ programa.name }}</p>
      <p class="text-sm text-slate-800">
        <span class="text-base font-semibold tabular-nums">{{ card.stamps }}</span>
        <span class="ml-1 text-slate-500">{{ card.stamps === 1 ? 'sello' : 'sellos' }}</span>
      </p>
    </div>

    <!-- Tarjeta simple: los puntitos de toda la vida. Es la forma en que
         cualquiera lee una tarjeta de sellos sin que se la expliquen. -->
    <div v-if="dibujaPuntos" class="mt-2.5 flex flex-wrap gap-1.5">
      <span
        v-for="(lleno, i) in puntos"
        :key="i"
        class="h-4 w-4 rounded-full border"
        :class="lleno ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'"
      />
    </div>

    <!-- Escalera: un riel con una marca por hito. Los sellos no se gastan, así
         que lo que importa no es "cuánto falta para llenar" sino dónde va
         dentro de todo el camino. -->
    <div v-else-if="tope > 0" class="mt-3">
      <div class="relative h-1.5 rounded-full bg-slate-200">
        <div
          class="absolute inset-y-0 left-0 rounded-full bg-indigo-500"
          :style="{ width: `${avance}%` }"
        />

        <span
          v-for="t in escalones"
          :key="t.stamps_required"
          class="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          :class="
            t.status === 'available'
              ? 'border-amber-500 bg-amber-400'
              : t.reached
                ? 'border-indigo-500 bg-indigo-500'
                : 'border-slate-300 bg-white'
          "
          :style="{ left: `${porcentaje(t.stamps_required)}%` }"
          :title="`${t.stamps_required} sellos · ${t.reward_label}`"
        />
      </div>

      <div class="relative mt-2 h-4">
        <span
          v-for="t in escalones"
          :key="t.stamps_required"
          class="absolute -translate-x-1/2 text-[11px] tabular-nums"
          :class="t.reached ? 'font-medium text-slate-600' : 'text-slate-400'"
          :style="{ left: `${porcentaje(t.stamps_required)}%` }"
        >
          {{ t.stamps_required }}
        </span>
      </div>
    </div>

    <!-- Lo que hay que decirle en voz alta, en palabras y no en marcas. -->
    <p v-if="card.remaining > 0" class="mt-2 text-sm text-slate-600">
      Le {{ card.remaining === 1 ? 'falta' : 'faltan' }}
      <span class="font-medium text-slate-800">{{ card.remaining }}</span>
      para {{ sinPuntoFinal(programa.reward_label) }}.
      <span v-if="masAdelante" class="text-slate-500">
        Después, a los {{ masAdelante.stamps_required }}:
        {{ sinPuntoFinal(masAdelante.reward_label) }}.
      </span>
    </p>

    <p v-else-if="!card.rewards.length" class="mt-2 text-sm text-slate-600">
      Ya llegó al final de la tarjeta.
    </p>
  </div>
</template>
