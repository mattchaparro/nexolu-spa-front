<script setup lang="ts">
import { usePlatformDashboard, VERTICAL_LABELS, PLAN_LABELS } from '../composables/usePlatform'

const { data, isLoading } = usePlatformDashboard()
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6">
      <h1 class="text-xl font-semibold text-slate-800">Resumen de plataforma</h1>
      <p class="mt-1 text-sm text-slate-500">Todos los negocios de Nexolú Spa.</p>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <template v-else-if="data">
      <div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-wide text-slate-400">Negocios activos</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
            {{ data.businesses.active }}
            <span class="text-base font-normal text-slate-400">/ {{ data.businesses.total }}</span>
          </p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-wide text-slate-400">Usuarios activos</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-800">{{ data.users }}</p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-wide text-slate-400">Citas · 30 días</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
            {{ data.appointments.last_30d }}
          </p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-wide text-slate-400">Citas próximas</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
            {{ data.appointments.upcoming }}
          </p>
        </article>
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <h2 class="mb-3 text-sm font-medium text-slate-700">Por vertical</h2>
          <p
            v-for="(count, vertical) in data.businesses.by_vertical"
            :key="vertical"
            class="flex justify-between py-1 text-sm text-slate-600"
          >
            <span>{{ VERTICAL_LABELS[vertical] ?? vertical }}</span>
            <span class="tabular-nums">{{ count }}</span>
          </p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <h2 class="mb-3 text-sm font-medium text-slate-700">Por plan</h2>
          <p
            v-for="(count, plan) in data.businesses.by_plan"
            :key="plan"
            class="flex justify-between py-1 text-sm text-slate-600"
          >
            <span>{{ PLAN_LABELS[plan] ?? plan }}</span>
            <span class="tabular-nums">{{ count }}</span>
          </p>
        </article>

        <!-- Lo primero que hay que mirar cuando alguien deja de usar el
             producto y todavía no lo ha dicho. -->
        <article class="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 class="mb-1 text-sm font-medium text-amber-900">Sin actividad</h2>
          <p class="mb-3 text-xs text-amber-800">Sin citas en los últimos 14 días.</p>

          <p v-if="!data.idle.length" class="text-sm text-amber-800">Ninguno. Todos operando.</p>

          <RouterLink
            v-for="business in data.idle"
            :key="business.id"
            :to="{ name: 'sa-business', params: { id: business.id } }"
            class="block py-1 text-sm text-amber-900 underline"
          >
            {{ business.name }}
          </RouterLink>
        </article>
      </div>
    </template>
  </section>
</template>
