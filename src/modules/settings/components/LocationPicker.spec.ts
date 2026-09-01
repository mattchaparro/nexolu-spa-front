import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import LocationPicker from './LocationPicker.vue'
import type { Location } from '../composables/useLocations'

/*
 * `useLocations` habla con el servidor. Acá lo que se prueba son las REGLAS del
 * selector, no la petición, así que el composable se reemplaza por una ref que
 * cada prueba llena a mano.
 */
const locations = ref<{ locations: Location[] } | undefined>(undefined)

vi.mock('../composables/useLocations', () => ({
  useLocations: () => ({ data: locations }),
}))

function sede(id: number, name: string, extra: Partial<Location> = {}): Location {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    address: null,
    phone: null,
    city: null,
    maps_url: null,
    is_primary: false,
    is_active: true,
    sort_order: 0,
    active_resources_count: null,
    ...extra,
  }
}

/**
 * El selector de sede de las pantallas de dinero.
 *
 * Sus reglas no son obvias y están repartidas en cuatro pantallas, que es
 * justamente por lo que vive en un componente: una copia que se desincroniza es
 * una pantalla que deja cerrar una caja que abarca dos cajones.
 */
describe('LocationPicker', () => {
  beforeEach(() => {
    locations.value = undefined
  })

  function montar(props: Record<string, unknown> = {}) {
    return mount(LocationPicker, {
      props: { modelValue: null, ...props },
    })
  }

  it('no se muestra con una sola sede', () => {
    // Un selector de una opción es ruido en la barra más usada del producto.
    locations.value = { locations: [sede(1, 'Principal', { is_primary: true })] }

    expect(montar().find('select').exists()).toBe(false)
  })

  it('no se muestra mientras no han cargado las sedes', () => {
    expect(montar().find('select').exists()).toBe(false)
  })

  it('aparece con más de una sede', () => {
    locations.value = {
      locations: [sede(1, 'Principal', { is_primary: true }), sede(2, 'Cedritos')],
    }

    const select = montar().find('select')

    expect(select.exists()).toBe(true)
    expect(select.findAll('option')).toHaveLength(3) // "Todas" + las dos
  })

  it('ignora las sedes apagadas', () => {
    // Una sede cerrada no se borra, pero tampoco se puede seguir eligiendo.
    locations.value = {
      locations: [
        sede(1, 'Principal', { is_primary: true }),
        sede(2, 'Cedritos', { is_active: false }),
      ],
    }

    expect(montar().find('select').exists()).toBe(false)
  })

  describe('cuando el acto ocurre en un cajón concreto', () => {
    beforeEach(() => {
      locations.value = {
        locations: [sede(1, 'Principal', { is_primary: true }), sede(2, 'Cedritos')],
      }
    })

    it('no ofrece "todas las sedes"', () => {
      // Un cuadre que abarque dos cajones no se puede confirmar contra
      // ninguno: el servidor lo rechaza, así que ni se ofrece.
      const opciones = montar({ requerido: true }).findAll('option')

      expect(opciones).toHaveLength(2)
      expect(opciones.map((o) => o.text())).not.toContain('Todas las sedes')
    })

    it('arranca en la principal en vez de en vacío', async () => {
      /*
       * Sin esto la pantalla pide el cuadre sin sede, el servidor responde 422
       * y la persona ve un error antes de haber tocado nada.
       */
      const wrapper = montar({ requerido: true })
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([1])
    })
  })

  it('sin `requerido` sí ofrece "todas"', () => {
    // En reportes y gastos "todas" es una respuesta legítima, y es la que el
    // dueño de dos locales quiere por defecto.
    locations.value = {
      locations: [sede(1, 'Principal', { is_primary: true }), sede(2, 'Cedritos')],
    }

    const opciones = montar().findAll('option')

    expect(opciones.map((o) => o.text())).toContain('Todas las sedes')
  })

  it('suelta una sede que dejó de existir', async () => {
    /*
     * La sede elegida puede haberse apagado desde otro dispositivo, o venir de
     * un valor recordado. Dejarla puesta hace que la pantalla pida datos de
     * una sede que el servidor va a rechazar, sin que se vea por qué.
     */
    locations.value = {
      locations: [sede(1, 'Principal', { is_primary: true }), sede(2, 'Cedritos')],
    }

    const wrapper = montar({ modelValue: 99 })
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })

  it('vuelve a "sin filtro" si queda un solo local', async () => {
    // Es el comportamiento de antes de que existieran las sedes.
    locations.value = { locations: [sede(1, 'Principal', { is_primary: true })] }

    const wrapper = montar({ modelValue: 2 })
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })

  it('emite el id como número, no como texto', async () => {
    /*
     * El value de un <option> es siempre string. Emitir "2" en vez de 2 hace
     * que la comparación con el id de la sede falle en silencio y el filtro
     * quede pegado.
     */
    locations.value = {
      locations: [sede(1, 'Principal', { is_primary: true }), sede(2, 'Cedritos')],
    }

    const wrapper = montar()
    await wrapper.find('select').setValue('2')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([2])
  })

  it('la opción vacía emite null, no cadena vacía', async () => {
    locations.value = {
      locations: [sede(1, 'Principal', { is_primary: true }), sede(2, 'Cedritos')],
    }

    const wrapper = montar({ modelValue: 2 })
    await wrapper.find('select').setValue('')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })
})
