import { computed } from 'vue'

import { useAuthStore } from '@/stores/auth.store'
import type { NavItem } from '@/types/navigation'

/**
 * El menu se arma cruzando permisos y feature flags contra las MISMAS metas
 * que declara el router.
 *
 * Es deliberado que sea una sola fuente: cuando el menu decide por su cuenta
 * que mostrar, termina ofreciendo opciones que el guard rechaza o el backend
 * responde con 403.
 */
const ITEMS: Array<NavItem & { permission?: string }> = [
  { label: 'Agenda', icon: 'pi pi-calendar', routeName: 'agenda', permission: 'citas.ver', featureKey: 'scheduling' },
  { label: 'Clientes', icon: 'pi pi-users', routeName: 'clients', permission: 'clientes.ver', featureKey: 'clients' },
  { label: 'Mi turno', icon: 'pi pi-wallet', routeName: 'cash-shift', permission: 'caja.turno', featureKey: 'cash_shift' },
  { label: 'Resumen', icon: 'pi pi-chart-line', routeName: 'daily-summary', permission: 'reportes.ver', featureKey: 'reports' },
  { label: 'Cierre', icon: 'pi pi-lock', routeName: 'daily-closing', permission: 'caja.cierre', featureKey: 'cash_closing' },
  { label: 'Gastos', icon: 'pi pi-receipt', routeName: 'expenses', permission: 'gastos.gestionar', featureKey: 'expenses' },
  { label: 'Servicios', icon: 'pi pi-sparkles', routeName: 'services', permission: 'servicios.gestionar' },
  { label: 'Equipo', icon: 'pi pi-id-card', routeName: 'resources', permission: 'recursos.gestionar' },
]

export function useNavItems() {
  const auth = useAuthStore()

  const navItems = computed<NavItem[]>(() =>
    ITEMS.filter((item) => {
      if (item.permission && !auth.can(item.permission)) {
        return false
      }

      if (item.featureKey && !auth.hasFeature(item.featureKey)) {
        return false
      }

      return true
    }).map(({ label, icon, routeName, featureKey }) => ({ label, icon, routeName, featureKey })),
  )

  return { navItems }
}
