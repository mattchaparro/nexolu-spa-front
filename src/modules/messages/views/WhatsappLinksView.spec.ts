import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { buildWhatsappUrl, type WhatsappLinksPayload } from '../composables/useWhatsappLinks'
import WhatsappLinksView from './WhatsappLinksView.vue'

const payload = ref<WhatsappLinksPayload | undefined>(undefined)
const save = vi.fn().mockResolvedValue({})
const remove = vi.fn().mockResolvedValue({})
const notify = vi.fn()

vi.mock('@/composables/useSystemAlert', () => ({ useSystemAlert: () => ({ notify }) }))

vi.mock('@/modules/agenda/composables/useAvailability', () => ({
  useServices: () => ({
    data: ref([
      { id: 1, name: 'Semipermanente' },
      { id: 2, name: 'Press-On' },
    ]),
  }),
}))

vi.mock('../composables/useWhatsappLinks', async (original) => ({
  ...(await original<typeof import('../composables/useWhatsappLinks')>()),
  useWhatsappLinks: () => ({ data: payload, isLoading: ref(false) }),
  useSaveWhatsappLink: () => ({ mutateAsync: save, isPending: ref(false) }),
  useDeleteWhatsappLink: () => ({ mutateAsync: remove }),
}))

describe('buildWhatsappUrl', () => {
  it('codifica el mensaje y usa el número con indicativo', () => {
    expect(buildWhatsappUrl('573019489912', 'Hola, quiero el 2x1 💅')).toBe(
      `https://wa.me/573019489912?text=${encodeURIComponent('Hola, quiero el 2x1 💅')}`,
    )
  })

  it('sin mensaje es el enlace pelado, y sin número no hay enlace', () => {
    expect(buildWhatsappUrl('573019489912', '  ')).toBe('https://wa.me/573019489912')
    expect(buildWhatsappUrl(null, 'Hola')).toBe('')
  })
})

describe('WhatsappLinksView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    payload.value = {
      number: '573019489912',
      links: [{ id: 7, name: 'Historia del sábado', message: 'Hola, quiero el press-on' }],
    }
  })

  it('lista los guardados con su enlace armado', () => {
    const wrapper = mount(WhatsappLinksView)

    const item = wrapper.get('[data-testid="wa-links-item"]')
    expect(item.text()).toContain('Historia del sábado')
    expect(item.text()).toContain(
      `https://wa.me/573019489912?text=${encodeURIComponent('Hola, quiero el press-on')}`,
    )
  })

  it('muestra la vista previa mientras escribes y guarda con nombre y mensaje', async () => {
    const wrapper = mount(WhatsappLinksView)

    await wrapper.get('[data-testid="wa-links-name"]').setValue('Promo')
    await wrapper.get('[data-testid="wa-links-message"]').setValue('Quiero la promo')

    expect(wrapper.get('[data-testid="wa-links-preview"]').text()).toContain(
      encodeURIComponent('Quiero la promo'),
    )

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(save).toHaveBeenCalledWith({ id: undefined, name: 'Promo', message: 'Quiero la promo' })
  })

  it('arrancar desde un servicio escribe el mensaje', async () => {
    const wrapper = mount(WhatsappLinksView)

    await wrapper.get('[data-testid="wa-links-service"]').setValue('2')

    expect(
      (wrapper.get('[data-testid="wa-links-message"]').element as HTMLTextAreaElement).value,
    ).toBe('Hola, quiero agendar Press-On 💅')
  })

  it('sin número avisa qué falta y no arma enlaces', () => {
    payload.value = { number: null, links: [] }
    const wrapper = mount(WhatsappLinksView)

    expect(wrapper.get('[data-testid="wa-links-missing-number"]').text()).toContain('WhatsApp')
    expect(wrapper.find('[data-testid="wa-links-preview"]').exists()).toBe(false)
  })
})
