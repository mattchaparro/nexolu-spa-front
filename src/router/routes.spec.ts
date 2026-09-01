import { describe, expect, it } from 'vitest'

import { routes } from './index'

/**
 * Que TODA vista del router compile.
 *
 * Esto existe por un bug concreto. Al correr Prettier, un manejador de dos
 * sentencias quedó partido en dos líneas sin punto y coma:
 *
 *     @booked="
 *       pick = null
 *       notify('Cita agendada.', 'success')
 *     "
 *
 * El compilador de plantillas de Vue lo rechaza. `/agenda` devolvía 500 y la
 * pantalla no cargaba — con síntoma de "no pudimos iniciar sesión", porque el
 * redirect después de entrar era justo a esa vista. `vue-tsc --noEmit` no lo
 * vio: NO compila plantillas.
 *
 * Importar cada componente lo compila. No prueba que la pantalla funcione, pero
 * atrapa la clase de error que se cuela entre el typecheck y el navegador.
 *
 * (`npm run build` también lo atrapa, y es la red de seguridad de verdad. Esto
 * lo dice más rápido y señalando cuál vista.)
 */
describe('las vistas del router', () => {
  const cargables = routes.flatMap((route) => {
    const propias = typeof route.component === 'function' ? [[route.name, route.component]] : []
    const hijas = (route.children ?? [])
      .filter((child) => typeof child.component === 'function')
      .map((child) => [child.name, child.component])

    return [...propias, ...hijas] as Array<[string, () => Promise<unknown>]>
  })

  it('hay vistas que revisar', () => {
    // Si el router cambia de forma y esto queda en cero, la prueba pasaría
    // sin comprobar nada. Mejor que falle y se note.
    expect(cargables.length).toBeGreaterThan(10)
  })

  it.each(cargables)('%s compila', async (_nombre, cargar) => {
    const modulo = (await cargar()) as { default?: unknown }

    expect(modulo.default).toBeTruthy()
  })
})
