import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import WhatsappLinks from './WhatsappLinks.vue'

vi.mock('@/composables/useSystemAlert', () => ({
  useSystemAlert: () => ({ notify: vi.fn() }),
}))

const services = [
  { id: 1, name: 'Semipermanente' },
  { id: 2, name: 'Press-On' },
]

function montar(number: string) {
  return mount(WhatsappLinks, { props: { number, services } })
}

describe('WhatsappLinks', () => {
  it('arma el enlace con el indicativo del país y el saludo para agendar', () => {
    const wrapper = montar('301 948 9912')

    expect(wrapper.get('[data-testid="wa-links-url"]').text()).toBe(
      `https://wa.me/573019489912?text=${encodeURIComponent('Hola, quiero agendar una cita 💅')}`,
    )
  })

  it('respeta un número que ya trae indicativo, sin el +', () => {
    const wrapper = montar('+57 301 948 9912')

    expect(wrapper.get('[data-testid="wa-links-url"]').text()).toContain('wa.me/573019489912?')
  })

  it('al elegir un servicio el mensaje lo nombra, y se puede editar', async () => {
    const wrapper = montar('3019489912')

    await wrapper.get('[data-testid="wa-links-service"]').setValue(2)
    expect(
      (wrapper.get('[data-testid="wa-links-message"]').element as HTMLTextAreaElement).value,
    ).toBe('Hola, quiero agendar Press-On 💅')

    await wrapper.get('[data-testid="wa-links-message"]').setValue('Quiero Press-On para el sábado')
    expect(wrapper.get('[data-testid="wa-links-url"]').text()).toContain(
      encodeURIComponent('Quiero Press-On para el sábado'),
    )
  })

  it('sin número no hay enlace: avisa qué falta', () => {
    const wrapper = montar('')

    expect(wrapper.find('[data-testid="wa-links-url"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="wa-links-missing-number"]').text()).toContain('número')
  })
})
