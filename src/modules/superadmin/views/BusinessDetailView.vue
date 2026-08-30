<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useAuthStore } from '@/stores/auth.store'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput, NxSelect, NxSwitch } from '@/ui'

import {
  useFeatureCatalog,
  useImpersonate,
  usePlatformBusiness,
  useUpdateBusiness,
  PLAN_LABELS,
  VERTICAL_LABELS,
} from '../composables/usePlatform'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { notify } = useSystemAlert()

const { mutateAsync: impersonate } = useImpersonate()
/** Id de la persona cuyo botón está cargando. */
const impersonating = ref<number | null>(null)

async function enterAs(userId: number, name: string): Promise<void> {
  impersonating.value = userId

  try {
    const data = await impersonate(userId)
    auth.impersonate(data)
    // A la agenda y no al panel: es donde el negocio vive, y es lo que la
    // persona que reportó el problema estaba mirando.
    await router.push({ name: 'agenda' })
  } catch (e) {
    notify(extractErrorMessage(e, `No pudimos entrar como ${name}.`), 'error')
  } finally {
    impersonating.value = null
  }
}

const id = computed(() => Number(route.params.id))
const { data: business, isLoading } = usePlatformBusiness(id)
const { data: catalog } = useFeatureCatalog()
const { mutateAsync: update, isPending } = useUpdateBusiness()

const PLANS = Object.entries(PLAN_LABELS).map(([value, label]) => ({ value, label }))

function modulesIn(group: string) {
  return (catalog.value?.catalog ?? []).filter((entry) => entry.group === group)
}

const name = ref('')
const timezone = ref('')
const plan = ref<string | null>(null)
const flags = ref<Record<string, boolean>>({})
const settings = ref<Record<string, number>>({})
/**
 * Topes del plan. Vacío = sin tope para ese negocio.
 *
 * Se editan los RESUELTOS, igual que las banderas: es lo que el negocio tiene
 * hoy. Guardar sólo lo explícito haría que bajar un tope heredado del plan no
 * tuviera efecto visible.
 */
const limits = ref<Record<string, number | null>>({})

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
    limits.value = { ...(b.resolved_limits ?? {}) }
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
    // Un campo vacío es "sin tope", no cero: un tope de 0 dejaría al negocio
    // sin poder agregar a nadie.
    plan_limits: Object.fromEntries(
      Object.entries(limits.value).map(([key, value]) => [
        key,
        value === null || String(value).trim() === '' ? null : Number(value),
      ]),
    ),
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

          <h3 class="mb-1 mt-5 text-sm font-medium text-slate-700">Equipo</h3>
          <p class="mb-2 text-xs text-slate-500">
            «Entrar como» abre el panel del negocio con los permisos de esa persona, para ver
            exactamente lo que ella ve. Queda registrado en la auditoría.
          </p>

          <div class="divide-y divide-slate-100 rounded-md border border-slate-200">
            <div
              v-for="member in business.users"
              :key="member.id"
              class="flex items-center gap-3 px-3 py-2"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm text-slate-800">
                  {{ member.name }}
                  <span v-if="!member.is_active" class="ml-1 text-xs text-red-600">inactivo</span>
                </span>
                <span class="block truncate text-xs text-slate-500">
                  {{ member.email }}
                  <span v-if="member.resource_name">· {{ member.resource_name }}</span>
                </span>
              </span>

              <span
                class="shrink-0 rounded px-2 py-0.5 text-xs"
                :class="member.is_admin ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'"
              >
                {{ member.is_admin ? 'Admin' : (member.role ?? 'sin rol') }}
              </span>

              <!-- Sin botón para los inactivos: mostraría una pantalla que
                   esa persona no puede ver, y llevaría a "arreglar" algo que
                   no está roto. El backend también lo rechaza. -->
              <NxButton
                v-if="member.is_active"
                variant="ghost"
                size="sm"
                :loading="impersonating === member.id"
                @click="enterAs(member.id, member.name)"
              >
                Entrar como
              </NxButton>
            </div>
          </div>
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

        <!-- Agrupados y con su nombre. Antes salían las llaves crudas
             (`no_show_penalties`, `whatsapp_agent`) y quien configura un
             negocio tenía que adivinar qué enciende: un interruptor que dice
             `managerial_accounting` no se prende con confianza. -->
        <div v-for="group in catalog?.groups ?? []" :key="group" class="mb-4 last:mb-0">
          <p class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{{ group }}</p>

          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <label
              v-for="entry in modulesIn(group)"
              :key="entry.key"
              class="flex items-start gap-2 rounded border border-slate-100 px-3 py-2"
              :title="entry.help"
            >
              <NxSwitch v-model="flags[entry.key]" :disabled="isPending" />
              <span class="min-w-0">
                <span class="block text-sm text-slate-700">{{ entry.label }}</span>
                <span class="block text-xs text-slate-500">{{ entry.help }}</span>
              </span>
            </label>
          </div>
        </div>
      </article>

      <!-- El otro eje del plan: no qué ve, sino cuánto puede cargar. -->
      <article class="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 class="mb-1 text-sm font-medium text-slate-700">Topes del plan</h2>
        <p class="mb-3 text-xs text-slate-500">
          Dejar vacío es sin tope. Se valida sólo al agregar: un negocio que ya quedó por encima
          sigue trabajando con lo que tiene.
        </p>

        <div class="grid gap-3 sm:grid-cols-2">
          <label
            v-for="entry in catalog?.limits ?? []"
            :key="entry.key"
            class="rounded border border-slate-100 px-3 py-2"
          >
            <span class="block text-sm text-slate-700">{{ entry.label }}</span>
            <span class="block text-xs text-slate-500">{{ entry.help }}</span>

            <span class="mt-2 flex items-center gap-2">
              <input
                v-model="limits[entry.key]"
                type="number"
                min="1"
                placeholder="Sin tope"
                class="w-28 rounded border border-slate-200 px-2 py-1 text-sm"
                :disabled="isPending"
              />
              <span class="text-xs text-slate-400">{{ entry.unit }}</span>
              <!-- El uso de hoy al lado del tope: sin esto, soporte no puede
                   responder "¿por qué no me deja agregar a nadie?" sin entrar
                   a mirar la base. -->
              <span v-if="business?.plan_usage?.[entry.key]" class="text-xs text-slate-500">
                · usa {{ business.plan_usage[entry.key].used }} hoy
              </span>
            </span>
          </label>
        </div>
      </article>
    </template>
  </section>
</template>
