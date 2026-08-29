import { useAuthStore } from '@/stores/auth.store'

/**
 * Formato de moneda del negocio.
 *
 * Un solo lugar: cada vista que lo reimplementaba terminaba con decimales
 * distintos, y en una pantalla de caja eso se lee como un descuadre.
 */
export function useMoney() {
  const auth = useAuthStore()

  function money(value: number | null | undefined): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: auth.business?.currency ?? 'COP',
      maximumFractionDigits: 0,
    }).format(value ?? 0)
  }

  /** Con signo explícito: en una diferencia, el signo ES el dato. */
  function signed(value: number | null | undefined): string {
    const amount = value ?? 0
    return `${amount > 0 ? '+' : ''}${money(amount)}`
  }

  return { money, signed }
}
