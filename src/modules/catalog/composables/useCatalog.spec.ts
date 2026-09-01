import { describe, expect, it } from 'vitest'

import { resourceFormData } from './useCatalog'

/**
 * El multipart de un recurso.
 *
 * Esto ya se rompió dos veces, las dos en silencio: el formulario decía
 * "guardado", el servidor no cambiaba nada, y sólo se descubría volviendo a
 * abrir la ficha. Es exactamente el tipo de fallo que un typecheck no ve.
 */
describe('resourceFormData', () => {
  it('manda null como cadena vacía, no lo omite', () => {
    /*
     * Laravel convierte la cadena vacía en null antes de validar, y los campos
     * que se pueden BORRAR están declarados `present`. Omitir los nulos hacía
     * imposible quitarle a alguien su reseña o su comisión una vez puestas: el
     * servidor los veía como "no me lo mandaste" y los dejaba igual.
     */
    const form = resourceFormData({ bio: null, commission_rate: null })

    expect(form.has('bio')).toBe(true)
    expect(form.get('bio')).toBe('')
    expect(form.get('commission_rate')).toBe('')
  })

  it('omite lo que de verdad no se mandó', () => {
    // `undefined` es "esta pantalla no pregunta eso", y es distinto de "lo
    // dejaron vacío a propósito".
    const form = resourceFormData({ name: 'Maria', location_id: undefined })

    expect(form.has('location_id')).toBe(false)
    expect(form.get('name')).toBe('Maria')
  })

  it('manda los booleanos como 1 y 0', () => {
    // Laravel lee "1"/"0" como booleano; "true"/"false" no — `is_public` en
    // false llegaría como el string "false", que es truthy.
    const form = resourceFormData({ is_public: false, is_bookable_online: true })

    expect(form.get('is_public')).toBe('0')
    expect(form.get('is_bookable_online')).toBe('1')
  })

  it('no confunde el cero con vacío', () => {
    // Comisión 0 es "esta persona no gana comisión", que NO es lo mismo que
    // "sin porcentaje propio". Omitirlo cambiaría lo que se le paga.
    const form = resourceFormData({ commission_rate: 0 })

    expect(form.get('commission_rate')).toBe('0')
  })

  it('adjunta la foto sólo cuando hay una', () => {
    const foto = new File(['x'], 'maria.jpg', { type: 'image/jpeg' })

    expect(resourceFormData({}, foto).has('photo')).toBe(true)
    expect(resourceFormData({}, null).has('photo')).toBe(false)
    expect(resourceFormData({}).has('photo')).toBe(false)
  })
})
