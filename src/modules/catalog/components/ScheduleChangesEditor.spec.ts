import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import ScheduleChangesEditor from './ScheduleChangesEditor.vue'
import type { ScheduleChange } from '../composables/useCatalog'

const changes = ref<ScheduleChange[]>([])
const create = vi.fn()
const remove = vi.fn().mockResolvedValue({})
const notify = vi.fn()

vi.mock('@/composables/useSystemAlert', () => ({ useSystemAlert: () => ({ notify }) }))

vi.mock('../composables/useCatalog', async (original) => ({
  ...(await original<typeof import('../composables/useCatalog')>()),
  useScheduleChanges: () => ({ data: changes }),
  useCreateScheduleChange: () => ({ mutateAsync: create, isPending: ref(false) }),
  useDeleteScheduleChange: () => ({ mutateAsync: remove }),
}))

// Trabaja de lunes a sábado de 9 a 17.
const weekly = [1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  start_time: '09:00',
  end_time: '17:00',
}))

// Un miércoles y un domingo fijos (el calendario no depende de «hoy»).
const MIERCOLES = '2099-01-07'
const DOMINGO = '2099-01-04'

function montar() {
  return mount(ScheduleChangesEditor, { props: { resourceId: 5, weekly } })
}

describe('ScheduleChangesEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    changes.value = []
    create.mockResolvedValue({ conflicts: [] })
  })

  it('propone quedarse desde la hora en que normalmente sale', async () => {
    const wrapper = montar()
    await wrapper.get('[data-testid="change-date"]').setValue(MIERCOLES)

    expect((wrapper.get('[data-testid="change-start"]').element as HTMLInputElement).value).toBe(
      '17:00',
    )
    expect((wrapper.get('[data-testid="change-end"]').element as HTMLInputElement).value).toBe(
      '20:00',
    )
  })

  it('un día que no trabaja propone una jornada normal', async () => {
    const wrapper = montar()
    await wrapper.get('[data-testid="change-date"]').setValue(DOMINGO)

    expect((wrapper.get('[data-testid="change-start"]').element as HTMLInputElement).value).toBe(
      '09:00',
    )
    expect((wrapper.get('[data-testid="change-end"]').element as HTMLInputElement).value).toBe(
      '18:00',
    )
  })

  it('guarda horas extra con día y horas', async () => {
    const wrapper = montar()
    await wrapper.get('[data-testid="change-date"]').setValue(MIERCOLES)
    await wrapper.get('[data-testid="change-end"]').setValue('21:00')

    await wrapper.get('[data-testid="change-save"]').trigger('click')
    await flushPromises()

    // Se llama con lo del formulario, en modo «trabaja más horas».
    const llamada = create.mock.calls.at(-1)?.[0]
    expect(llamada).toMatchObject({
      resourceId: 5,
      kind: 'extra_hours',
      date: MIERCOLES,
      start_time: '17:00',
      end_time: '21:00',
    })
  })

  it('quitar horas todo el día manda all_day y no las horas', async () => {
    const wrapper = montar()
    await wrapper.get('[data-testid="mode-off"]').trigger('click')
    await wrapper.get('[data-testid="change-date"]').setValue(MIERCOLES)
    await wrapper.get('[data-testid="change-all-day"]').setValue(true)

    expect(wrapper.find('[data-testid="change-start"]').exists()).toBe(false)

    await wrapper.get('[data-testid="change-save"]').trigger('click')
    await flushPromises()

    const llamada = create.mock.calls.at(-1)?.[0]
    expect(llamada).toMatchObject({ kind: 'block', date: MIERCOLES, all_day: true })
    expect(llamada).not.toHaveProperty('start_time')
  })

  it('avisa de las citas que quedaron dentro de lo que se quitó', async () => {
    create.mockResolvedValue({
      conflicts: [
        {
          appointment_id: 9,
          date: MIERCOLES,
          time: '14:00',
          client_name: 'Carolina',
          service_name: 'Semipermanente',
        },
      ],
    })
    const wrapper = montar()
    await wrapper.get('[data-testid="mode-off"]').trigger('click')
    await wrapper.get('[data-testid="change-date"]').setValue(MIERCOLES)

    await wrapper.get('[data-testid="change-save"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="change-conflicts"]').text()).toContain('Carolina')
  })

  it('lista lo que viene en palabras', () => {
    changes.value = [
      {
        id: 1,
        kind: 'extra_hours',
        date: MIERCOLES,
        end_date: MIERCOLES,
        all_day: false,
        start_time: '17:00',
        end_time: '21:00',
        reason: null,
        conflicts: [],
      },
      {
        id: 2,
        kind: 'block',
        date: MIERCOLES,
        end_date: MIERCOLES,
        all_day: false,
        start_time: '12:00',
        end_time: '17:00',
        reason: 'Clase',
        conflicts: [],
      },
    ]
    const wrapper = montar()

    const filas = wrapper.findAll('[data-testid="change-row"]').map((r) => r.text())
    expect(filas[0]).toContain('Trabaja de 5:00 pm a 9:00 pm')
    expect(filas[1]).toContain('No trabaja de 12:00 pm a 5:00 pm')
    expect(filas[1]).toContain('Clase')
  })
})
