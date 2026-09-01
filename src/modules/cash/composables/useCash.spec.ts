import { describe, expect, it } from 'vitest'

import { expenseFormData } from './useCash'

/**
 * El multipart de un gasto.
 *
 * Acá el detalle decide plata: si `location_id` viaja como null o se omite,
 * cambia en qué caja entra ese gasto — o si no entra en ninguna.
 */
describe('expenseFormData', () => {
  it('distingue "no me lo preguntaron" de "es del negocio entero"', () => {
    /*
     * Omitirlo deja que el servidor lo ponga en la sede de quien lo registra.
     * Mandar null explícito dice "este gasto no lo paga ningún cajón" — la
     * contadora, el dominio. Si los dos casos llegaran igual, un gasto del
     * negocio entero descuadraría la caja de un local.
     */
    const sinPreguntar = expenseFormData({ description: 'Domicilio' })
    const delNegocio = expenseFormData({ description: 'Contadora', location_id: null })

    expect(sinPreguntar.has('location_id')).toBe(false)
    expect(delNegocio.has('location_id')).toBe(true)
    expect(delNegocio.get('location_id')).toBe('')
  })

  it('no pierde el valor ni la fecha', () => {
    const form = expenseFormData({ value: 20000, date: '2026-09-01' })

    expect(form.get('value')).toBe('20000')
    expect(form.get('date')).toBe('2026-09-01')
  })

  it('adjunta el comprobante sólo cuando hay uno', () => {
    const recibo = new File(['x'], 'recibo.jpg', { type: 'image/jpeg' })

    expect(expenseFormData({}, recibo).has('receipt')).toBe(true)
    expect(expenseFormData({}, null).has('receipt')).toBe(false)
  })
})
