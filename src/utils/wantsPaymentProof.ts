/**
 * Si hay que pedir el comprobante de pago.
 *
 * Vive aparte del componente porque es una REGLA, no un detalle de pantalla:
 * cruza la política del negocio con el medio de pago elegido, y equivocarse
 * falla en silencio en las dos direcciones. De más, le pide una foto a quien
 * pagó en efectivo y termina enseñándole al equipo a ignorar el campo; de
 * menos, el cierre del día vuelve a cuadrar contra lo que alguien dijo que
 * entró — que es exactamente lo que el cierre existe para no hacer.
 *
 * `non_cash` es la política útil: el efectivo se cuenta en el cajón y no
 * necesita comprobante; una transferencia no se puede contar.
 */
export function wantsPaymentProof(
  policy: 'none' | 'non_cash' | 'always' | undefined,
  countsAsCash: boolean | undefined,
): boolean {
  if (policy === 'always') {
    return true
  }

  if (policy !== 'non_cash') {
    return false
  }

  /*
   * Sin método elegido todavía no se pregunta. `undefined` acá no es "no
   * cuenta como efectivo": es "nadie ha decidido cómo paga", y pedir el
   * comprobante de un pago que no existe es ruido en la pantalla más
   * apurada del negocio.
   */
  return countsAsCash === false
}
