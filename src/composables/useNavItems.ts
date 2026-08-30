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
const ITEMS: Array<NavItem & { permission?: string; onlyStaff?: boolean }> = [
  // Primero lo suyo: quien atiende entra a ver su dia, no la agenda del
  // negocio entero.
  { label: 'Mi día', icon: 'pi pi-user', routeName: 'my-work' },

  {
    label: 'Agenda',
    icon: 'pi pi-calendar',
    routeName: 'agenda',
    permission: 'citas.ver',
    featureKey: 'scheduling',
  },
  {
    label: 'Clientes',
    icon: 'pi pi-users',
    routeName: 'clients',
    permission: 'clientes.ver',
    featureKey: 'clients',
  },

  // Solo aparece si el negocio opera con turnos de caja. Viene apagado: en un
  // spa nadie abre y cierra caja, lo que importa es el cierre del dia.
  {
    label: 'Mi turno',
    icon: 'pi pi-wallet',
    routeName: 'cash-shift',
    permission: 'caja.turno',
    featureKey: 'cash_shift',
  },

  {
    label: 'Resumen',
    icon: 'pi pi-chart-line',
    routeName: 'daily-summary',
    permission: 'reportes.ver',
    featureKey: 'reports',
  },
  {
    label: 'Ventas',
    icon: 'pi pi-chart-bar',
    routeName: 'sales-report',
    permission: 'reportes.ver',
    featureKey: 'reports',
  },
  {
    label: 'Cierre',
    icon: 'pi pi-lock',
    routeName: 'daily-closing',
    permission: 'caja.cierre',
    featureKey: 'cash_closing',
  },
  {
    label: 'Gastos',
    icon: 'pi pi-receipt',
    routeName: 'expenses',
    permission: 'gastos.gestionar',
    featureKey: 'expenses',
  },
  {
    label: 'Nómina',
    icon: 'pi pi-money-bill',
    routeName: 'payroll',
    permission: 'nomina.gestionar',
    featureKey: 'payroll',
  },
  {
    label: 'Servicios',
    icon: 'pi pi-sparkles',
    routeName: 'services',
    permission: 'servicios.gestionar',
  },
  {
    label: 'Equipo',
    icon: 'pi pi-id-card',
    routeName: 'resources',
    permission: 'recursos.gestionar',
  },
  // Sin `featureKey`: el negocio de un solo local también entra, aunque sea
  // para ponerle dirección y enlace de Maps a su sede.
  {
    label: 'Sedes',
    icon: 'pi pi-map-marker',
    routeName: 'locations',
    permission: 'negocio.configurar',
  },
  {
    label: 'Mi página',
    icon: 'pi pi-globe',
    routeName: 'public-page',
    permission: 'negocio.configurar',
    featureKey: 'online_booking',
  },
  {
    label: 'Campañas',
    icon: 'pi pi-megaphone',
    routeName: 'campaigns',
    permission: 'servicios.gestionar',
    featureKey: 'promotions',
  },
  {
    label: 'Fidelización',
    icon: 'pi pi-star',
    routeName: 'loyalty',
    permission: 'servicios.gestionar',
    featureKey: 'loyalty',
  },
  {
    label: 'Medios de pago',
    icon: 'pi pi-credit-card',
    routeName: 'payment-methods',
    permission: 'negocio.configurar',
  },
  {
    label: 'Permisos',
    icon: 'pi pi-shield',
    routeName: 'permissions',
    permission: 'permisos.gestionar',
    featureKey: 'permissions_management',
  },
  {
    label: 'Pagos al equipo',
    icon: 'pi pi-percentage',
    routeName: 'compensation',
    permission: 'nomina.gestionar',
    featureKey: 'payroll',
  },
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
