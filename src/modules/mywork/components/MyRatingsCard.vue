<script setup lang="ts">
import { computed } from 'vue'

import type { MyRatings } from '../composables/useMyWork'

/*
|------------------------------------------------------------------------------
| Cómo la califican
|------------------------------------------------------------------------------
| El dueño lo pidió así: que su gente vea sus calificaciones y que eso las
| motive a mejorar. Las dos mitades importan, y la segunda es la difícil.
|
| Tres decisiones, y ninguna es de estilo:
|
| 1. SÓLO LAS SUYAS. Nada de tabla comparativa. Dos manicuristas que trabajan a
|    un metro viendo la nota de la otra convierte una herramienta en un
|    problema entre ellas. Cada una ve cómo va; quien compara es quien paga.
|
| 2. LOS COMENTARIOS PRIMERO, y grandes. Un 96% no le dice a nadie qué hacer
|    distinto. "Me encantó cómo me quedaron" sí dice qué se está haciendo bien,
|    y es lo que una se queda leyendo.
|
| 3. NADA EN ROJO. Si el mes viene más bajo se dice, sin alarma: lo que hace
|    que alguien deje de mirar una pantalla es que la pantalla la regañe.
*/

const props = defineProps<{ ratings: MyRatings }>()

const hayNotas = computed(() => props.ratings.count > 0)

/** Los tres ejes, con el nombre que usa una clienta y no el de la base. */
const ejes = computed(() => [
  { label: 'Atención', value: props.ratings.attention },
  { label: 'El servicio', value: props.ratings.service },
  { label: 'Puntualidad', value: props.ratings.punctuality },
])

function pct(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}%`
}

/*
 * La comparación con el mes pasado sólo cuando SIGNIFICA algo.
 *
 * Con dos o tres opiniones, una sola clienta mueve el promedio veinte puntos,
 * y un "bajaste" por eso es ruido. El aviso que más rápido deja de creerse es
 * el que se dispara solo.
 */
const MINIMO_PARA_COMPARAR = 3

const tendencia = computed(() => {
  const hoy = props.ratings.this_month
  const antes = props.ratings.previous_month

  if (
    hoy.attention === null ||
    antes.attention === null ||
    hoy.count < MINIMO_PARA_COMPARAR ||
    antes.count < MINIMO_PARA_COMPARAR
  ) {
    return null
  }

  const diferencia = Math.round(hoy.attention - antes.attention)

  if (diferencia === 0) {
    return { texto: 'Vas igual que el mes pasado.', sube: null }
  }

  return diferencia > 0
    ? { texto: `Vas ${diferencia} puntos mejor que el mes pasado.`, sube: true }
    : { texto: `Vas ${Math.abs(diferencia)} puntos por debajo del mes pasado.`, sube: false }
})

function fecha(iso: string | null): string {
  if (!iso) return ''

  // `T00:00` para que el navegador no lo lea como UTC y muestre el día
  // anterior: la fecha viene ya en la zona del negocio.
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  })
}
</script>

<template>
  <section class="rounded-lg border border-slate-200 bg-white p-4">
    <header class="flex items-baseline justify-between gap-3">
      <h2 class="text-sm font-medium text-slate-700">Cómo te califican</h2>
      <span v-if="hayNotas" class="text-xs text-slate-500">
        {{ ratings.count }} {{ ratings.count === 1 ? 'opinión' : 'opiniones' }}
      </span>
    </header>

    <!-- Sin opiniones no se pinta un cero gigante: no es que la califiquen
         mal, es que todavía nadie contestó. -->
    <p v-if="!hayNotas" class="mt-2 text-sm text-slate-500">
      Todavía no tienes opiniones. Aparecen acá cuando una clienta responde la encuesta después de
      su cita.
    </p>

    <template v-else>
      <div class="mt-3 grid grid-cols-3 gap-3">
        <article v-for="eje in ejes" :key="eje.label">
          <p class="text-xs text-slate-500">{{ eje.label }}</p>
          <p class="mt-0.5 text-2xl font-semibold tabular-nums text-slate-800">
            {{ pct(eje.value) }}
          </p>
          <div class="mt-1 h-1.5 rounded-full bg-slate-100">
            <div
              class="h-full rounded-full bg-emerald-500"
              :style="{ width: `${eje.value ?? 0}%` }"
            />
          </div>
        </article>
      </div>

      <p
        v-if="tendencia"
        class="mt-3 text-sm"
        :class="tendencia.sube === false ? 'text-slate-600' : 'text-emerald-700'"
      >
        {{ tendencia.texto }}
      </p>

      <!-- Lo que de verdad mueve a alguien. Va abajo pero pesa más que los
           números de arriba: un porcentaje no dice qué hacer distinto. -->
      <div v-if="ratings.comments.length" class="mt-4 border-t border-slate-100 pt-3">
        <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Lo que escribieron</p>

        <ul class="mt-2 flex flex-col gap-2">
          <li v-for="(c, i) in ratings.comments" :key="i" class="rounded-md bg-slate-50 px-3 py-2">
            <p class="text-sm text-slate-700">«{{ c.comment }}»</p>
            <p class="mt-0.5 text-xs text-slate-400">{{ fecha(c.date) }}</p>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>
