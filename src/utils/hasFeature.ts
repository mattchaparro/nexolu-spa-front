import type { Business } from '@/types/auth'

/**
 * Lee la bandera YA resuelta por el backend (Business::resolvedFeatures(),
 * expuesta como `resolved_features` en BusinessResource) en vez de replicar
 * aca la logica de resolucion de feature_flags/plan.
 *
 * Antes esta funcion reimplementaba las 3 ramas de Business::hasFeature()
 * (null/vacio -> todo habilitado, clave presente -> su valor, clave ausente
 * -> ???) a mano, y la ultima rama tenia un bug real: una clave ausente en
 * un feature_flags no vacio se asumia habilitada en vez de resolverse con
 * el default del plan (que es lo que el backend SI hace) - un negocio
 * Basico terminaba viendo en el menu funciones que no le corresponden.
 * Exponer el mapa ya resuelto elimina la clase entera de bug: hay una sola
 * implementacion de la logica (el backend), no dos que se puedan
 * desincronizar. El servidor sigue siendo la fuente de verdad real en cada
 * endpoint gateado por `feature:`, esto solo decide que UI mostrar.
 */
export function hasFeature(business: Business | undefined | null, feature: string): boolean {
  return business?.resolved_features?.[feature] === true
}
