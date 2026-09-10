<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BookingFlow from '../components/BookingFlow.vue'
import { usePublicPage } from '../composables/usePublicBooking'

const route = useRoute()
const router = useRouter()

const slug = computed(() => String(route.params.businessSlug ?? ''))

/*
 * La sede sale de la URL, no de un estado interno.
 *
 * Así el enlace que el negocio pega en el WhatsApp de Cedritos abre Cedritos,
 * y el que la clienta comparte con una amiga abre el mismo local. Un selector
 * que sólo viviera en memoria produciría enlaces que llevan a otra parte.
 */
const locationSlug = computed(() =>
  route.params.locationSlug ? String(route.params.locationSlug) : null,
)

/*
 * El token del cliente, si el enlace lo trae: `?c=<token>`.
 *
 * Es lo que hace que el formulario llegue con su nombre y su teléfono puestos.
 * El navegador no conoce esos datos — el negocio sí, porque ya estaban en la
 * ficha, y el token dice de quién es.
 */
const clientToken = computed(() => (route.query.c ? String(route.query.c) : null))

const { data: page, isLoading, isError } = usePublicPage(slug, locationSlug, clientToken)

const sedes = computed(() => page.value?.locations ?? [])

/**
 * Hay que preguntar a qué local va.
 *
 * Sólo con varias sedes y ninguna elegida. Con una sola el servidor la
 * resuelve él y la pregunta nunca aparece: un paso con una sola respuesta es
 * una pantalla de más entre la clienta y su cita.
 */
const debeElegirSede = computed(() => sedes.value.length > 1 && page.value?.location === null)

function irASede(sedeSlug: string): void {
  router.replace({
    name: 'public-booking',
    params: { businessSlug: slug.value, locationSlug: sedeSlug },
  })
}

/** Servicio elegido desde la lista de arriba, para saltar directo al paso 2. */
const preselected = ref<number | null>(null)
/** Lo mismo para un combo. */
const preselectedPackage = ref<number | null>(null)

const verTodos = ref(0)

watch(page, (value) => {
  if (value) {
    document.title = `${value.business.name} · Reservar`
  }
})

/** Días agrupados por franja: "Lun a Vie 9:00–18:00" se lee, siete líneas no. */
const groupedHours = computed(() => {
  const days = page.value?.hours ?? []
  const groups: Array<{ label: string; hours: string }> = []

  for (const day of days) {
    const hours = day.opens ? `${day.opens} – ${day.closes}` : 'Cerrado'
    const last = groups[groups.length - 1]

    if (last && last.hours === hours) {
      last.label = `${last.label.split(' a ')[0]} a ${day.label}`
    } else {
      groups.push({ label: day.label, hours })
    }
  }

  return groups
})
</script>

<template>
  <div class="min-h-screen bg-white">
    <p v-if="isLoading" class="p-10 text-center text-slate-500">Cargando…</p>

    <!-- Un negocio que no existe, está suspendido o no tiene reserva en línea
         se ve igual: no es asunto de quien pasa por la URL cuál de las tres. -->
    <div v-else-if="isError || !page" class="flex min-h-screen items-center justify-center p-10">
      <div class="text-center">
        <p class="text-lg font-medium text-slate-800">Esta página no está disponible</p>
        <p class="mt-2 text-sm text-slate-500">Revisa el enlace o escríbele directo al negocio.</p>
      </div>
    </div>

    <template v-else>
      <!-- Portada -->
      <header class="relative">
        <div
          class="h-44 bg-slate-200 bg-cover bg-center sm:h-64"
          :style="
            page.business.cover_url
              ? { backgroundImage: `url(${page.business.cover_url})` }
              : undefined
          "
        />

        <div class="mx-auto max-w-3xl px-5">
          <div class="-mt-10 flex items-end gap-4">
            <img
              v-if="page.business.logo_url"
              :src="page.business.logo_url"
              :alt="page.business.name"
              class="h-20 w-20 rounded-xl border-4 border-white object-cover shadow-sm"
            />
            <div
              v-else
              class="flex h-20 w-20 items-center justify-center rounded-xl border-4 border-white bg-slate-800 text-2xl font-bold text-white shadow-sm"
            >
              {{ page.business.name.charAt(0) }}
            </div>
          </div>

          <h1 class="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {{ page.profile.headline }}
          </h1>
          <p v-if="page.profile.about" class="mt-2 max-w-2xl text-slate-600">
            {{ page.profile.about }}
          </p>

          <div class="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
            <a
              v-if="page.business.address"
              :href="page.profile.maps_url ?? undefined"
              :target="page.profile.maps_url ? '_blank' : undefined"
              rel="noopener"
              class="flex items-center gap-1.5"
              :class="page.profile.maps_url ? 'underline' : ''"
            >
              <i class="pi pi-map-marker" />{{ page.business.address }}
            </a>
            <a
              v-if="page.profile.whatsapp"
              :href="`https://wa.me/${page.profile.whatsapp.replace(/\D/g, '')}`"
              target="_blank"
              rel="noopener"
              class="flex items-center gap-1.5 underline"
            >
              <i class="pi pi-whatsapp" />WhatsApp
            </a>
            <a
              v-if="page.profile.instagram"
              :href="page.profile.instagram"
              target="_blank"
              rel="noopener"
              class="flex items-center gap-1.5 underline"
            >
              <i class="pi pi-instagram" />Instagram
            </a>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-3xl px-5 py-10">
        <!-- A qué local va.
             Antes que nada: los servicios, el equipo y las horas de abajo ya
             son los de la sede elegida, y enseñarlos sin haber preguntado
             sería enseñar los de un local al azar. -->
        <section v-if="debeElegirSede" class="mb-10">
          <h2 class="mb-1 text-lg font-semibold text-slate-900">¿A cuál sede vas?</h2>
          <p class="mb-4 text-sm text-slate-500">
            Cada local tiene su propio equipo y su propio horario.
          </p>

          <div class="grid gap-3 sm:grid-cols-2">
            <button
              v-for="sede in sedes"
              :key="sede.id"
              type="button"
              class="rounded-xl border border-slate-200 p-4 text-left transition hover:border-slate-500"
              @click="irASede(sede.slug)"
            >
              <p class="font-medium text-slate-800">{{ sede.name }}</p>
              <p v-if="sede.address || sede.city" class="mt-1 text-sm text-slate-500">
                {{ [sede.address, sede.city].filter(Boolean).join(' · ') }}
              </p>
            </button>
          </div>
        </section>

        <template v-else>
          <!-- La sede en la que está, con salida.
             Va arriba y no escondida: alguien que llegó por el enlace
             equivocado tiene que poder darse cuenta ANTES de reservar, no el
             día de la cita en la puerta del otro local. -->
          <p
            v-if="page.location && sedes.length > 1"
            class="mb-6 flex flex-wrap items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-700"
          >
            <i class="pi pi-map-marker text-slate-400" />
            Estás reservando en <b>{{ page.location.name }}</b>
            <button
              type="button"
              class="ml-auto underline"
              @click="router.replace({ name: 'public-booking', params: { businessSlug: slug } })"
            >
              Cambiar de sede
            </button>
          </p>

          <!-- La vitrina de combos y "los más pedidos" vivía acá arriba.
               Se quitó: repetía el catálogo que el paso 1 ya muestra con
               buscador, fichas y la lista agrupada -- y lo repetía ARRIBA,
               así que quien llegaba rodaba dos veces la misma lista antes de
               poder reservar. En una pantalla de teléfono dentro de WhatsApp
               eso es la diferencia entre reservar y cerrar la página. -->

          <!-- Reservar -->
          <section class="mb-10 scroll-mt-4">
            <h2 class="mb-3 text-lg font-semibold text-slate-900">Reservar tu cita</h2>
            <BookingFlow
              :slug="slug"
              :page="page"
              :preselected="preselected"
              :preselected-package="preselectedPackage"
              :ver-todos="verTodos"
            />
          </section>

          <!-- Horario y equipo -->
          <div class="grid gap-8 sm:grid-cols-2">
            <section>
              <h2 class="mb-3 text-lg font-semibold text-slate-900">Horario</h2>
              <dl class="text-sm">
                <div
                  v-for="(group, i) in groupedHours"
                  :key="i"
                  class="flex justify-between border-b border-slate-100 py-1.5"
                >
                  <dt class="text-slate-600">{{ group.label }}</dt>
                  <dd :class="group.hours === 'Cerrado' ? 'text-slate-400' : 'text-slate-800'">
                    {{ group.hours }}
                  </dd>
                </div>
              </dl>
            </section>

            <!-- Colaboradores: foto, reseña corta y puntuación.
                 Sale `page.team` y no `page.resources`: aquel es el selector de
                 "con quién reservar", y son conjuntos que no coinciden. Alguien
                 cuya agenda maneja el mostrador no acepta reservas por internet
                 y aun así merece estar en la vitrina. -->
            <section v-if="page.team.length">
              <h2 class="mb-3 text-lg font-semibold text-slate-900">Quiénes te atienden</h2>

              <div class="flex flex-col gap-4">
                <div v-for="person in page.team" :key="person.id" class="flex gap-3">
                  <img
                    v-if="person.photo_url"
                    :src="person.photo_url"
                    :alt="person.name"
                    class="h-16 w-16 shrink-0 rounded-full object-cover"
                  />
                  <div
                    v-else
                    class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-500"
                  >
                    {{ person.name.charAt(0) }}
                  </div>

                  <div class="min-w-0">
                    <p class="font-medium text-slate-800">{{ person.name }}</p>

                    <!-- La nota y DE CUÁNTAS: "4.8" solo es una cifra que no se
                         puede juzgar. Sin suficientes calificaciones no se
                         muestra nada — un 0.0 al lado de una foto lee como
                         "pésimo", no como "todavía no sabemos". -->
                    <p v-if="person.rating !== null" class="text-sm text-amber-600">
                      ★ {{ person.rating }}
                      <span class="text-xs text-slate-400">
                        ({{ person.ratings_count }} calificaciones)
                      </span>
                    </p>

                    <p v-if="person.bio" class="mt-0.5 text-sm text-slate-600">{{ person.bio }}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </template>
      </main>

      <footer class="border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        {{ page.business.name }} · Agenda con Nexolú
      </footer>
    </template>
  </div>
</template>
