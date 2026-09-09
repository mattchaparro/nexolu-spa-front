import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { httpClient } from '@/services/http/client'
import { useAuthStore } from '@/stores/auth.store'

import { useNavBadges } from './useNavBadges'

/**
 * Los numeritos del menu NO se piden cuando quien mira no tiene negocio.
 *
 * Esto existe por un bug que se vio en un telefono. El superadmin entraba por
 * SSO, el panel de plataforma cargaba bien, y encima le aparecia "No tienes
 * permiso para esta accion" -- el 403 de `/nav-badges`, una pantalla que ni
 * siquiera se estaba mostrando.
 *
 * Es el tercer error de la misma familia: un llamado que sale sin que nadie
 * comprobara si la persona podia hacerlo. Los otros dos (la bandeja de
 * WhatsApp visible para una manicurista, y el 403 de `/locations` en su inicio)
 * tambien los reporto el dueño usando la app, no las pruebas.
 */
describe('los numeritos del menú', () => {
  const montar = () => {
    const espia = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: {} } as never)

    const componente = defineComponent({
      setup() {
        useNavBadges()

        return () => h('div')
      },
    })

    mount(componente, {
      global: {
        plugins: [
          [VueQueryPlugin, { queryClient: new QueryClient() }] as unknown as never,
        ],
      },
    })

    return espia
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('no los pide cuando la persona no tiene negocio', async () => {
    const auth = useAuthStore()
    // Un usuario de plataforma: existe, entro bien, y no tiene negocio.
    auth.user = { id: 1, is_super_admin: true, business: null } as never

    const espia = montar()
    await new Promise((r) => setTimeout(r, 0))

    expect(espia).not.toHaveBeenCalled()
  })

  it('sí los pide dentro de un negocio', async () => {
    const auth = useAuthStore()
    auth.user = { id: 2, is_super_admin: false, business: { id: 1 } } as never

    const espia = montar()
    await new Promise((r) => setTimeout(r, 0))

    expect(espia).toHaveBeenCalledWith('/nav-badges')
  })
})
