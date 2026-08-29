// Fecha local en formato YYYY-MM-DD. Nunca usar Date.toISOString().slice(0, 10)
// para esto: toISOString() convierte a UTC, y en Bogota (UTC-5) desde las
// 19:00 hora local en adelante eso ya cae en el dia siguiente en UTC - "hoy"
// quedaba mal calculado toda la noche (afectaba filtros de fecha en historial
// de ventas, resumen del dia, ventas por vendedor, recordatorios, etc).
export function toLocalDateIso(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
