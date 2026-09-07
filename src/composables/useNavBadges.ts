import { useQuery } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

/*
|------------------------------------------------------------------------------
| Los numeritos del menú
|------------------------------------------------------------------------------
| Cuántas conversaciones esperan respuesta y cuántos mensajes esperan que
| alguien los mande.
|
| Existen porque estas dos pantallas son las únicas donde alguien de AFUERA
| está esperando: una clienta que escribió y nadie le contestó, un recordatorio
| que no salió. El resto del menú son cosas que el negocio hace cuando quiere.
|
| UN solo llamado para los dos contadores, y trae CONTEOS, no listas: el menú
| se pinta en cada pantalla, así que este es de los pocos llamados que se
| repiten todo el día.
*/

export interface NavBadges {
  inbox_unread: number
  outbox_pending: number
}

export function useNavBadges() {
  const { data } = useQuery({
    queryKey: ['nav-badges'],
    queryFn: async () => (await httpClient.get<NavBadges>('/nav-badges')).data,
    /*
     * Cada minuto. Más seguido no sirve de nada — nadie mira el menú
     * esperando que cambie un número — y menos seguido deja a una clienta
     * esperando sin que se note.
     */
    refetchInterval: 60_000,
    /*
     * Un fallo acá no puede romper el menú: si el contador no llega, el menú
     * se pinta sin numeritos y todo lo demás funciona igual.
     */
    retry: false,
  })

  function badge(key?: 'inbox_unread' | 'outbox_pending'): number {
    if (!key || !data.value) return 0

    return data.value[key] ?? 0
  }

  return { badge }
}
