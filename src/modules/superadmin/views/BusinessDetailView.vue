<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { NxButton, NxInput, NxSelect, NxSwitch } from '@/ui'

import {
  useFeatureCatalog,
  usePlatformBusiness,
  useUpdateBusiness,
  PLAN_LABELS,
  VERTICAL_LABELS,
} from '../composables/usePlatform'

const route = useRoute()
const { notify } = useSystemAlert()

const id = computed(() => Number(route.params.id))
const { data: business, isLoading } = usePlatformBusiness(id)
const { data: catalog } = useFeatureCatalog()
const { mutateAsync: update, isPending } = useUpdateBusiness()

const PLANS = Object.entries(PLAN_LABELS).map(([value, label]) => ({ value, label }))

const name = ref('')
const timezone = ref('')
const plan = ref<string | null>(null)
const flags = ref<Record<string, boolean>>({})
const settings = ref<Record<string, number>>({})

watch(
  business,
  (b) => {
    if (!b) {
      return
    }

    name.value = b.name
    timezone.value = b.timezone
    plan.value = b.subscription_plan
    // Se editan las banderas RESUELTAS, no las explícitas: es lo que el
    // negocio realmente tiene hoy. Guardar solo lo explícito haría que
    // apagar algo heredado del plan no tuviera ningún efecto visible.
    flags.value = { ...b.resolved_features }
    settings.value = { ...b.scheduling_settings }
  },
  { immediate: true },
)

const SETTING_LABELS: Record<string, string> = {
  slot_granularity_min: 'Granularidad de la agenda (min)',
  min_booking_notice_min: 'Anticipación mínima para reservar (min)',
  min_cancellation_notice_min: 'Anticipación mínima para cancelar (min)',
  max_booking_horizon_days: 'Se puede reservar hasta (días)',
  no_show_penalty_amount: 'Multa por inasistencia',
}

async function save(): Promise<void> {
  await update({
    id: id.value,
    name: name.value.trim(),
    timezone: timezone.value.trim(),
    subscription_plan: plan.value ?? undefined,
    feature_flags: flags.value,
    scheduling_settings: Object.fromEntries(
      Object.entries(settings.value).map(([key, value]) => [key, Number(value)]),
    ),
  })
  notify('Negocio actualizado.', 'success')
}
</script>

<template>
  <section class="p-6 md:p-8">
    <RouterLink :to="{ name: 'sa-businesses' }" class="text-sm text-indigo-600 hover:underline">
      ‹ Negocios
    </RouterLink>

    <p v-if="isLoading" class="mt-6 text-sm text-slate-500">Cargando…</p>

    <template v-else-if="business">
      <header class="mb-6 mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-slate-800">{{ business.name }}</h1>
          <p class="mt-1 text-sm text-slate-500">
            {{ VERTICAL_LABELS[business.vertical] ?? business.vertical }} ·
            <span class="font-mono text-xs">{{ business.slug }}</span>
            <span v-if="!business.is_active" class="text-red-600"> · suspendido</span>
          </p>
        </div>
        <NxButton :loading="isPending" @click="save">Guardar cambios</NxButton>
      </header>

      <div class="mb-6 grid gap-4 sm:grid-cols-4">
        <article
          v-for="(value, key) in business.counts"
          :key="key"
          class="rounded-lg border border-slate-200 bg-white p-3"
        >
          <p class="text-xs uppercase tracking-wide text-slate-400">
            {{
              { users: 'Usuarios', resources: 'Equipo', services: 'Servicios', appointments_30d: 'Citas 30d' }[key]
            }}
          </p>
          <p class="mt-1 text-xl font-semibold tabular-nums text-slate-800">{{ value }}</p>
        </article>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <h2 class="mb-3 text-sm font-medium text-slate-700">Datos</h2>

          <div class="flex flex-col gap-3">
            <NxInput v-model="name" label="Nombre" :disabled="isPending" />
            <NxInput v-model="timezone" label="Zona horaria" :disabled="isPending" />
            <NxSelect
              v-model="plan"
              :options="PLANS"
              option-label="label"
              option-value="value"
              label="Plan"
              :disabled="isPending"
            />
          </div>

          <h3 class="mb-2 mt-5 text-sm font-medium text-slate-700">Dueños</h3>
          <p v-for="owner in business.owners" :key="owner.id" class="text-sm text-slate-600">
            {{ owner.name }} · {{ owner.email }}
            <span v-if="!owner.is_active" class="text-red-600">(inactivo)</span>
          </p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <h2 class="mb-3 text-sm font-medium text-slate-700">Configuración de agenda</h2>

          <div class="flex flex-col gap-3">
            <NxInput
              v-for="(label, key) in SETTING_LABELS"
              :key="key"
              v-model="settings[key] as unknown as string"
              :label="label"
              inputmode="numeric"
              :disabled="isPending"
            />
          </div>
        </article>
      </div>

      <article class="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 class="mb-1 text-sm font-medium text-slate-700">Módulos habilitados</h2>
        <p class="mb-3 text-xs text-slate-500">
          Lo que el negocio ve hoy. El plan define los valores por defecto; acá se ajusta caso por caso.
        </p>

        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label
            v-for="flag in catalog?.flags ?? []"
            :key="flag"
            class="flex items-center gap-2 rounded border border-slate-100 px-3 py-2 text-sm text-slate-700"
          >
            <NxSwitch v-model="flags[flag]" :disabled="isPending" />
            <span class="font-mono text-xs">{{ flag }}</span>
          </label>
        </div>
      </article>
    </template>
  </section>
</template>
