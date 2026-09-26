/**
 * Fechas como las lee ella: "3 de septiembre", "1 de agosto al 31 de agosto".
 *
 * Las fechas de pago y de vale son columnas `date` del servidor: se leen al
 * mediodía para que ninguna zona horaria las corra al día anterior.
 */
export function diaLegible(iso: string | null, conMes = true): string {
  if (!iso) return '—'

  return new Date(`${iso}T12:00`).toLocaleDateString('es-CO', {
    day: 'numeric',
    ...(conMes ? { month: 'long' } : {}),
  })
}

export function periodo(desde: string | null, hasta: string | null): string {
  return `${diaLegible(desde)} al ${diaLegible(hasta)}`
}
