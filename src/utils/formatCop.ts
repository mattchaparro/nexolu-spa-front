// Portado de pos-saas-legacy/resources/js/utils/formatCop.js - peso
// colombiano: valor entero redondeado, separadores es-CO, sin decimales.
export function formatCop(value: number | string | null | undefined): string {
  const n = Math.round(Number(value) || 0)
  return `$${n.toLocaleString('es-CO', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`
}
