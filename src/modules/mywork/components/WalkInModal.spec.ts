import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { ref } from 'vue'

import WalkInModal from './WalkInModal.vue'

/*
 * Ponerse al día: registrar hoy los servicios de otros días.
 *
 * Alejandra empezó a usar la aplicación con una semana de servicios sin subir.
 * Antes de esto el formulario no preguntaba el día y el servidor asumía "ahora",
 * así que todo lo atrasado caía en la fecha equivocada -- y con ello la comisión
 * de ese corte y el cierre de caja de ese día.
 */
const registrado = vi.fn()

vi.mock('../composables/useMyWork', () => ({
  useWalkIn: () => ({ mutateAsync: registrado, isPending: ref(false) }),
}))

vi.mock('@/modules/agenda/composables/useAvailability', () => ({
  useServices: () => ({
    data: ref([{ id: 7, name: 'Semipermanente', price: 45000, duration_min: 60 }]),
  }),
}))

vi.mock('@/modules/agenda/composables/useAppointments', () => ({
  searchClients: async () => [],
}))

vi.mock('@/composables/usePaymentMethods', () => ({
  usePaymentMethods: () => ({ data: ref([{ id: 1, name: 'Efectivo' }]) }),
}))

// Parcial: el `queryClient` de la aplicación se construye al importar y lo
// necesitan otros módulos de la cadena.
vi.mock('@tanstack/vue-query', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useQuery: () => ({ data: ref([{ id: 3, name: 'Alejandra', type: 'staff' }]) }),
}))

// jsdom no trae `matchMedia` y el desplegable de PrimeVue lo llama al montarse.
window.matchMedia = vi.fn().mockReturnValue({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}) as unknown as typeof window.matchMedia

function montar() {
  return mount(WalkInModal, {
    props: { open: true, myResourceId: 3 },
    global: {
      // PrimeVue de verdad: los campos de NxInput son suyos, y montarlos
      // comprueba de paso que la plantilla compile -- que es exactamente como
      // ya se cayó una vista entera por un manejador partido en dos líneas.
      plugins: [PrimeVue],
      stubs: { NxModal: { template: '<div><slot /></div>' } },
    },
  })
}

async function registrar(wrapper: ReturnType<typeof montar>) {
  const vm = wrapper.vm as unknown as Record<string, unknown>
  vm.term = 'Carolina'
  await wrapper.vm.$nextTick()
  await (vm.submit as () => Promise<void>)()

  return registrado.mock.calls.at(-1)?.[0] as { started_at: string }
}

describe('Servicio sin cita', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    registrado.mockReset()
    registrado.mockResolvedValue({})
    vi.useFakeTimers()
    // Un miércoles a las 3 de la tarde, hora de Bogotá en la máquina de prueba.
    vi.setSystemTime(new Date(2026, 8, 9, 15, 0, 0))
  })

  it('manda el día elegido y no el de hoy', async () => {
    const wrapper = montar()
    const vm = wrapper.vm as unknown as Record<string, unknown>

    vm.fecha = '2026-09-05'
    vm.hora = '14:30'

    const payload = await registrar(wrapper)

    expect(payload.started_at).toBe('2026-09-05T14:30')
  })

  it('recuerda el día al registrar el siguiente', async () => {
    const wrapper = montar()
    const vm = wrapper.vm as unknown as Record<string, unknown>

    vm.fecha = '2026-09-05'
    vm.hora = '09:00'
    await registrar(wrapper)

    // La vista deja el modal montado y sólo alterna `open`, que es cuando se
    // limpian los campos. Ese barrido NO puede llevarse el día: subir ocho
    // servicios del sábado son ocho aperturas seguidas, y si cada una vuelve a
    // hoy, a la tercera se le pasa y el servicio cae en el día equivocado.
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })

    expect(vm.fecha).toBe('2026-09-05')
    expect(vm.term).toBe('')
  })

  it('no deja registrar hacia adelante', async () => {
    const wrapper = montar()
    const vm = wrapper.vm as unknown as Record<string, unknown>

    vm.fecha = '2099-01-01'
    await wrapper.vm.$nextTick()

    expect(vm.fecha).toBe('2026-09-09')
  })
})
