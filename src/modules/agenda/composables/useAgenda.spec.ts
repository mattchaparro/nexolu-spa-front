import { describe, expect, it } from 'vitest'

import { toMinutes, toTime } from './useAgenda'

/**
 * El eje de la rejilla se mide en minutos desde medianoche.
 *
 * Es aritmética simple, y por eso mismo nadie la mira: un error acá no revienta
 * nada, sólo pinta las citas corridas media hora. Y una cita pintada donde no
 * va es peor que una que no se pinta, porque nadie la revisa.
 */
describe('toMinutes / toTime', () => {
  it('convierte una hora a minutos desde medianoche', () => {
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes('09:30')).toBe(570)
    expect(toMinutes('23:59')).toBe(1439)
  })

  it('vuelve de minutos a hora con dos dígitos', () => {
    // Sin el relleno saldría "9:0" y la rejilla lo alinearía mal.
    expect(toTime(0)).toBe('00:00')
    expect(toTime(570)).toBe('09:30')
    expect(toTime(1439)).toBe('23:59')
  })

  it('ida y vuelta no pierde nada', () => {
    for (const hora of ['08:00', '09:15', '13:45', '18:30', '20:05']) {
      expect(toTime(toMinutes(hora))).toBe(hora)
    }
  })

  it('lee la hora con segundos sin corromperse', () => {
    // El backend manda "H:i", pero un `starts_at` completo pasa por acá en
    // más de un sitio y no puede terminar en NaN.
    expect(toMinutes('09:30:00')).toBe(570)
  })
})
