<script setup lang="ts">
import { computed, ref } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useMoney } from '@/modules/cash/composables/useMoney'
import { useAuthStore } from '@/stores/auth.store'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton } from '@/ui'

import ProductFormModal from '../components/ProductFormModal.vue'
import VenderProductoModal from '../components/VenderProductoModal.vue'
import {
  useAdjustStock,
  useDeactivateProduct,
  useProducts,
  type AdminProduct,
} from '../composables/useProducts'

/*
|------------------------------------------------------------------------------
| Productos e inventario
|------------------------------------------------------------------------------
| Lo que se vende y no se presta: cremas, esmaltes, velas. En el sistema viejo
| el stock era una columna que se editaba a mano y los movimientos se anotaban
| aparte, y terminaban diciendo cosas distintas.
|
| Acá el stock NO se edita: se mueve. "Entró mercancía" y "conté y hay menos"
| son dos hechos distintos, y los dos quedan escritos. Por eso no hay un campo
| de stock en el formulario.
*/

const auth = useAuthStore()
const { notify } = useSystemAlert()
const { money } = useMoney()

const { data, isLoading } = useProducts()
const { mutateAsync: ajustar } = useAdjustStock()
const { mutateAsync: desactivar } = useDeactivateProduct()

const editando = ref<AdminProduct | null>(null)
const abierto = ref(false)
const vendiendo = ref<AdminProduct | null>(null)

const productos = computed(() => data.value?.data ?? [])
const porReponer = computed(() => data.value?.low_stock ?? 0)

const valorInventario = computed(() =>
  productos.value.reduce((suma, p) => suma + p.price * p.stock, 0),
)

function crear(): void {
  editando.value = null
  abierto.value = true
}

function editar(p: AdminProduct): void {
  editando.value = p
  abierto.value = true
}

async function entrada(p: AdminProduct): Promise<void> {
  const cuantos = window.prompt(`¿Cuántos entraron de "${p.name}"?`, '1')

  if (cuantos === null) return

  const n = Number(cuantos)

  if (!Number.isInteger(n) || n < 1) {
    notify('Escribe un número entero mayor que cero.', 'warn')

    return
  }

  try {
    await ajustar({ id: p.id, kind: 'entrada', quantity: n })
    notify(`Entraron ${n} de ${p.name}.`, 'success')
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos registrar la entrada.'), 'error')
  }
}

/**
 * Conteo físico: se escribe cuántos HAY, no cuántos sobran o faltan.
 *
 * Nadie cuenta "menos tres": cuenta y le da cuatro. La diferencia la saca el
 * sistema y queda anotada como ajuste, que es lo que después explica por qué
 * el saldo cambió sin una venta.
 */
async function contar(p: AdminProduct): Promise<void> {
  const hay = window.prompt(
    `¿Cuántos hay de "${p.name}"? (el sistema dice ${p.stock})`,
    String(p.stock),
  )

  if (hay === null) return

  const n = Number(hay)

  if (!Number.isInteger(n) || n < 0) {
    notify('Escribe cuántos hay, en número entero.', 'warn')

    return
  }

  const diferencia = n - p.stock

  if (diferencia === 0) {
    notify('El conteo coincide, no hay nada que ajustar.', 'info')

    return
  }

  try {
    await ajustar({
      id: p.id,
      kind: 'ajuste',
      quantity: diferencia,
      note: `Conteo: había ${n}, el sistema decía ${p.stock}`,
    })
    notify(`Ajustado a ${n}.`, 'success')
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos ajustar.'), 'error')
  }
}

async function apagar(p: AdminProduct): Promise<void> {
  if (!window.confirm(`¿Quitar "${p.name}" del catálogo? Sus ventas viejas se conservan.`)) return

  await desactivar(p.id)
  notify('Producto quitado del catálogo.', 'success')
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Productos</h1>
        <p class="mt-1 text-sm text-slate-500">
          Lo que vendes sin prestarlo. Se puede vender acá suelto, o al cobrar un servicio.
        </p>
      </div>

      <NxButton v-if="auth.can('servicios.gestionar')" @click="crear">Nuevo producto</NxButton>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <template v-else>
      <div class="mb-6 grid gap-3 sm:grid-cols-3">
        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-wide text-slate-400">En catálogo</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
            {{ productos.length }}
          </p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-wide text-slate-400">Valor del inventario</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
            {{ money(valorInventario) }}
          </p>
        </article>

        <!-- Lo que hay que reponer va aparte y en ámbar: es lo único de esta
             pantalla que pide una acción hoy. -->
        <article
          class="rounded-lg border p-4"
          :class="porReponer ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'"
        >
          <p
            class="text-xs uppercase tracking-wide"
            :class="porReponer ? 'text-amber-700' : 'text-slate-400'"
          >
            Por reponer
          </p>
          <p
            class="mt-1 text-2xl font-semibold tabular-nums"
            :class="porReponer ? 'text-amber-900' : 'text-slate-800'"
          >
            {{ porReponer }}
          </p>
        </article>
      </div>

      <p v-if="!productos.length" class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600">
        Todavía no hay productos. Crea el primero para poder venderlo.
      </p>

      <div v-else class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table class="w-full text-sm">
          <thead
            class="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400"
          >
            <tr>
              <th class="px-4 py-3">Producto</th>
              <th class="px-4 py-3 text-right">Precio</th>
              <th class="px-4 py-3 text-right">Quedan</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="p in productos" :key="p.id" :class="{ 'bg-amber-50/50': p.is_low }">
              <td class="px-4 py-3">
                <p class="font-medium text-slate-800">{{ p.name }}</p>
                <p v-if="p.cost !== null" class="text-xs text-slate-400">
                  te cuesta {{ money(p.cost) }}
                </p>
              </td>
              <td class="px-4 py-3 text-right tabular-nums text-slate-700">{{ money(p.price) }}</td>
              <td class="px-4 py-3 text-right">
                <span
                  class="tabular-nums font-medium"
                  :class="
                    p.stock === 0 ? 'text-red-600' : p.is_low ? 'text-amber-700' : 'text-slate-800'
                  "
                >
                  {{ p.stock }}
                </span>
                <span v-if="p.stock === 0" class="ml-1 text-xs text-red-600">agotado</span>
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap justify-end gap-2">
                  <NxButton
                    v-if="auth.can('caja.cobrar') && p.stock > 0"
                    size="sm"
                    @click="vendiendo = p"
                  >
                    Vender
                  </NxButton>

                  <template v-if="auth.can('servicios.gestionar')">
                    <NxButton variant="outline" size="sm" @click="entrada(p)">Entró</NxButton>
                    <NxButton variant="ghost" size="sm" @click="contar(p)">Contar</NxButton>
                    <NxButton variant="ghost" size="sm" @click="editar(p)">Editar</NxButton>
                    <NxButton variant="ghost" size="sm" @click="apagar(p)">Quitar</NxButton>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <ProductFormModal
      :product="editando"
      :open="abierto"
      @close="abierto = false"
      @saved="
        () => {
          abierto = false
          notify('Producto guardado.', 'success')
        }
      "
    />

    <VenderProductoModal
      :product="vendiendo"
      :open="vendiendo !== null"
      @close="vendiendo = null"
      @sold="
        () => {
          vendiendo = null
          notify('Venta registrada.', 'success')
        }
      "
    />
  </section>
</template>
