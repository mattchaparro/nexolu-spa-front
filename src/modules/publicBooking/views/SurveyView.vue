<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useMutation, useQuery } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

/*
|------------------------------------------------------------------------------
| La encuesta que abre el cliente
|------------------------------------------------------------------------------
| Llega por un enlace de WhatsApp, así que aplica lo mismo que la reserva: se
| abre en el navegador embebido, en un teléfono, sin sesión. Y una cosa más que
| pesa acá: nadie responde una encuesta larga. Tres toques y listo.
*/

const route = useRoute()
const token = computed(() => String(route.params.token ?? ''))

interface SurveyItem {
  item_id: number
  service_name: string | null
  resource_name: string | null
}

interface SurveyForm {
  business: { name: string; google_review_url: string | null }
  date_label: string
  answered: boolean
  items: SurveyItem[]
}

const { data, isLoading, isError } = useQuery({
  queryKey: ['survey', token],
  retry: false,
  queryFn: async () => (await httpClient.get<SurveyForm>(`/survey/${token.value}`)).data,
})

/** Nota por persona. La clave es el id de la línea. */
const staff = ref<Record<number, number>>({})
const service = ref<Record<number, number>>({})
const comment = ref('')
const done = ref(false)
const error = ref<string | null>(null)

const { mutateAsync, isPending } = useMutation({
  mutationFn: async (payload: unknown) =>
    (await httpClient.post(`/survey/${token.value}`, payload)).data,
})

/** Hay algo que mandar: al menos una estrella en algún lado. */
const canSubmit = computed(
  () => Object.keys(staff.value).length > 0 || Object.keys(service.value).length > 0,
)

async function submit(): Promise<void> {
  error.value = null

  try {
    await mutateAsync({
      answers: (data.value?.items ?? []).map((item) => ({
        item_id: item.item_id,
        staff_rating: staff.value[item.item_id] ?? null,
        service_rating: service.value[item.item_id] ?? null,
        // El comentario es de la visita, no de una persona: quien escribe no
        // separa "el lugar" de "quien me atendió", y obligar a repetirlo por
        // cada una es la forma más rápida de que no escriba nada.
        comment: comment.value.trim() || null,
      })),
    })
    done.value = true
  } catch {
    error.value = 'No pudimos guardar tu respuesta. Intenta de nuevo.'
  }
}

const ESTRELLAS = [1, 2, 3, 4, 5]
</script>

<template>
  <main class="mx-auto min-h-screen max-w-lg px-5 py-10 [touch-action:manipulation]">
    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <p v-else-if="isError" class="rounded-xl bg-slate-100 px-4 py-6 text-sm text-slate-600">
      Este enlace ya no está disponible. Si quieres contarnos algo, escríbenos por WhatsApp.
    </p>

    <template v-else-if="data">
      <!-- Ya respondió, o acaba de responder -->
      <div
        v-if="done || data.answered"
        class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"
      >
        <p
          class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white"
        >
          ✓
        </p>
        <h1 class="mt-3 text-lg font-semibold text-emerald-900">¡Gracias por contarnos!</h1>
        <p class="mt-2 text-sm text-emerald-800">
          Lo leemos todo. Si algo no estuvo bien, te vamos a escribir.
        </p>

        <!-- Se le ofrece a TODO el que responde, no solo a quien calificó
             bien. Filtrar por nota se llama "review gating" y las políticas de
             Google lo prohíben: puede costarle la ficha entera al negocio. -->
        <a
          v-if="data.business.google_review_url"
          :href="data.business.google_review_url"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-5 inline-flex min-h-12 items-center rounded-xl bg-slate-900 px-4 py-3 font-medium text-white"
        >
          Dejar una reseña en Google
        </a>
      </div>

      <template v-else>
        <header class="mb-6">
          <h1 class="text-xl font-semibold text-slate-900">¿Cómo te fue en {{ data.business.name }}?</h1>
          <p class="mt-1 text-sm first-letter:uppercase text-slate-500">{{ data.date_label }}</p>
        </header>

        <div v-for="item in data.items" :key="item.item_id" class="mb-6">
          <p class="text-sm font-medium text-slate-800">
            {{ item.service_name }}
            <span v-if="item.resource_name" class="font-normal text-slate-500">
              · con {{ item.resource_name }}
            </span>
          </p>

          <!-- Dos preguntas y no cinco: el trabajo pudo quedar bien y la
               atención mal, pero más allá de eso nadie contesta. -->
          <div class="mt-3 space-y-3">
            <div>
              <p class="mb-1 text-xs text-slate-500">¿Cómo quedó el trabajo?</p>
              <div class="flex gap-1">
                <button
                  v-for="n in ESTRELLAS"
                  :key="`s${n}`"
                  type="button"
                  class="flex h-11 w-11 items-center justify-center rounded-lg text-2xl transition"
                  :class="(service[item.item_id] ?? 0) >= n ? 'text-amber-400' : 'text-slate-200'"
                  :aria-label="`${n} de 5`"
                  @click="service[item.item_id] = n"
                >
                  ★
                </button>
              </div>
            </div>

            <div>
              <p class="mb-1 text-xs text-slate-500">
                ¿Y la atención de {{ item.resource_name ?? 'quien te atendió' }}?
              </p>
              <div class="flex gap-1">
                <button
                  v-for="n in ESTRELLAS"
                  :key="`p${n}`"
                  type="button"
                  class="flex h-11 w-11 items-center justify-center rounded-lg text-2xl transition"
                  :class="(staff[item.item_id] ?? 0) >= n ? 'text-amber-400' : 'text-slate-200'"
                  :aria-label="`${n} de 5`"
                  @click="staff[item.item_id] = n"
                >
                  ★
                </button>
              </div>
            </div>
          </div>
        </div>

        <label class="block text-sm text-slate-700">
          ¿Algo que quieras contarnos? (opcional)
          <textarea
            v-model="comment"
            rows="3"
            class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base text-slate-900 outline-none focus:border-slate-900"
            :disabled="isPending"
          />
        </label>

        <p v-if="error" class="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ error }}
        </p>

        <button
          type="button"
          class="mt-5 min-h-12 w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white transition active:bg-slate-700 disabled:opacity-40"
          :disabled="!canSubmit || isPending"
          @click="submit"
        >
          {{ isPending ? 'Enviando…' : 'Enviar' }}
        </button>
      </template>
    </template>
  </main>
</template>
