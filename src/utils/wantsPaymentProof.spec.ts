import { describe, expect, it } from 'vitest'

import { wantsPaymentProof } from './wantsPaymentProof'

/**
 * Cuándo se pide el comprobante.
 *
 * Es una regla de dos entradas que falla en silencio en las dos direcciones,
 * así que se prueba entera en vez de confiar en mirarla en pantalla.
 */
describe('wantsPaymentProof', () => {
  it('apagada no pide nada, pague como pague', () => {
    expect(wantsPaymentProof('none', false)).toBe(false)
    expect(wantsPaymentProof('none', true)).toBe(false)
  })

  it('sin política configurada tampoco', () => {
    // Un negocio anterior a esta función no debería empezar a pedir fotos
    // porque alguien desplegó.
    expect(wantsPaymentProof(undefined, false)).toBe(false)
  })

  it('en non_cash pide sólo lo que no entra al cajón', () => {
    // El efectivo se cuenta al cerrar el día; una transferencia no.
    expect(wantsPaymentProof('non_cash', true)).toBe(false)
    expect(wantsPaymentProof('non_cash', false)).toBe(true)
  })

  it('en non_cash no pregunta hasta que se elija el método', () => {
    /*
     * `undefined` no es "no cuenta como efectivo": es "nadie ha decidido cómo
     * paga". Tratarlo como transferencia mostraría el campo apenas se abre el
     * cobro, en la pantalla más apurada del negocio.
     */
    expect(wantsPaymentProof('non_cash', undefined)).toBe(false)
  })

  it('en always lo pide siempre, incluso en efectivo', () => {
    // Es la política del negocio que quiere respaldo de todo.
    expect(wantsPaymentProof('always', true)).toBe(true)
    expect(wantsPaymentProof('always', undefined)).toBe(true)
  })
})
