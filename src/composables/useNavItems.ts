import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useAuthStore } from '@/stores/auth.store'
import type { NavBadgeKey, NavItem, NavTab } from '@/types/navigation'

/**
 * El menu se arma cruzando permisos y feature flags contra las MISMAS metas
 * que declara el router.
 *
 * Es deliberado que sea una sola fuente: cuando el menu decide por su cuenta
 * que mostrar, termina ofreciendo opciones que el guard rechaza o el backend
 * responde con 403.
 *
 * AGRUPADO (26-sep-2026). Eran 27 opciones sueltas: lo de WhatsApp en cinco
 * lugares, lo del equipo en cuatro. Ahora son pocas entradas y cada una trae
 * sus pantallas como pestañas arriba (ver `currentTabs` y AppLayout). Ninguna
 * pantalla se perdió, y cada pestaña sigue saliendo según los permisos de
 * quien entra: la entrada del menú lleva a la primera que puede ver.
 */
interface Entry {
  label: string
  icon?: string
  routeName: string
  permission?: string
  featureKey?: string
  badgeKey?: NavBadgeKey
  /** Solo para quien atiende (tiene un lugar en la agenda). */
  onlyStaff?: boolean
}

interface Group {
  label: string
  icon: string
  tabs: Entry[]
}

const MENU: Array<Entry | Group> = [
  /*
   * Lo suyo primero. Para quien atiende el menú es esto y la agenda, nada
   * más: su día, lo que lleva ganado y sus vales. Lo demás (mensajes, lista
   * de espera, productos) no era de ella y la distraía.
   */
  { label: 'Mi día', icon: 'pi pi-user', routeName: 'my-work', onlyStaff: true },
  {
    label: 'Agenda',
    icon: 'pi pi-calendar',
    routeName: 'agenda',
    permission: 'citas.ver',
    featureKey: 'scheduling',
  },
  { label: 'Mis ganancias', icon: 'pi pi-wallet', routeName: 'my-earnings', onlyStaff: true },
  { label: 'Mis vales', icon: 'pi pi-ticket', routeName: 'my-advances', onlyStaff: true },

  // Preguntarle en palabras en vez de leer tablas.
  {
    label: 'Asistente',
    icon: 'pi pi-sparkles',
    routeName: 'assistant',
    permission: 'ia.asistente',
  },

  {
    label: 'WhatsApp',
    icon: 'pi pi-whatsapp',
    tabs: [
      /*
       * Con `clientes.ver` y NO con `citas.ver`: la bandeja muestra el
       * teléfono y el nombre de todas las clientas que han escrito. Eso es
       * la base de clientes del negocio.
       */
      {
        label: 'Conversaciones',
        routeName: 'inbox',
        permission: 'clientes.ver',
        badgeKey: 'inbox_unread',
      },
      // Lo que el sistema prepara y manda solo: recordatorios, gracias...
      // Con `citas.ver_todas`: a quien atiende no le sirve.
      {
        label: 'Mensajes automáticos',
        routeName: 'outbox',
        permission: 'citas.ver_todas',
        badgeKey: 'outbox_pending',
      },
      /*
       * Aparte de «Campañas», que son descuentos. Una difusión es un mensaje
       * que SALE hacia las clientas y se paga por cada uno.
       */
      {
        label: 'Difusiones',
        routeName: 'broadcasts',
        permission: 'servicios.gestionar',
        featureKey: 'promotions',
      },
      { label: 'Enséñale al bot', routeName: 'bot-knowledge', permission: 'ia.conocimiento' },
      // Lo que Meta cobra por WhatsApp: solo quien administra el negocio.
      { label: 'Gasto', routeName: 'whatsapp-spend', permission: 'negocio.configurar' },
    ],
  },

  {
    label: 'Clientes',
    icon: 'pi pi-users',
    tabs: [
      {
        label: 'Clientes',
        routeName: 'clients',
        permission: 'clientes.ver',
        featureKey: 'clients',
      },
      {
        label: 'Lista de espera',
        routeName: 'waitlist',
        permission: 'citas.ver_todas',
        featureKey: 'reminders',
      },
      {
        label: 'Fidelización',
        routeName: 'loyalty',
        permission: 'servicios.gestionar',
        featureKey: 'loyalty',
      },
    ],
  },

  {
    label: 'Caja',
    icon: 'pi pi-chart-line',
    tabs: [
      {
        label: 'Resumen del día',
        routeName: 'daily-summary',
        permission: 'reportes.ver',
        featureKey: 'reports',
      },
      {
        label: 'Cierre',
        routeName: 'daily-closing',
        permission: 'caja.cierre',
        featureKey: 'cash_closing',
      },
      {
        label: 'Ventas',
        routeName: 'sales-report',
        permission: 'reportes.ver',
        featureKey: 'reports',
      },
      {
        label: 'Gastos',
        routeName: 'expenses',
        permission: 'gastos.gestionar',
        featureKey: 'expenses',
      },
      // Solo si el negocio opera con turnos de caja. Viene apagado.
      {
        label: 'Mi turno',
        routeName: 'cash-shift',
        permission: 'caja.turno',
        featureKey: 'cash_shift',
      },
    ],
  },

  {
    label: 'Equipo',
    icon: 'pi pi-id-card',
    tabs: [
      { label: 'Personas', routeName: 'resources', permission: 'recursos.gestionar' },
      {
        label: 'Nómina',
        routeName: 'payroll',
        permission: 'nomina.gestionar',
        featureKey: 'payroll',
      },
      {
        label: 'Cómo se les paga',
        routeName: 'compensation',
        permission: 'nomina.gestionar',
        featureKey: 'payroll',
      },
      {
        label: 'Permisos',
        routeName: 'permissions',
        permission: 'permisos.gestionar',
        featureKey: 'permissions_management',
      },
    ],
  },

  {
    label: 'Catálogo',
    icon: 'pi pi-tags',
    tabs: [
      { label: 'Servicios', routeName: 'services', permission: 'servicios.gestionar' },
      /*
       * En el menú con `citas.ver_todas`: la crema se vende dentro del cobro,
       * así que quien atiende no necesita la pantalla. La ruta sigue abierta
       * con `citas.ver` por si alguien entra por el enlace.
       */
      {
        label: 'Productos',
        routeName: 'products',
        permission: 'citas.ver_todas',
        featureKey: 'product_sales',
      },
      {
        label: 'Campañas',
        routeName: 'campaigns',
        permission: 'servicios.gestionar',
        featureKey: 'promotions',
      },
    ],
  },

  {
    label: 'Configuración',
    icon: 'pi pi-cog',
    tabs: [
      {
        label: 'Mi página',
        routeName: 'public-page',
        permission: 'negocio.configurar',
        featureKey: 'online_booking',
      },
      { label: 'Sedes', routeName: 'locations', permission: 'negocio.configurar' },
      { label: 'Medios de pago', routeName: 'payment-methods', permission: 'negocio.configurar' },
    ],
  },
]

function isGroup(item: Entry | Group): item is Group {
  return 'tabs' in item
}

export function useNavItems() {
  const auth = useAuthStore()
  const route = useRoute()

  function allowed(entry: Entry): boolean {
    if (entry.onlyStaff && !auth.user?.resource_id) return false
    if (entry.permission && !auth.can(entry.permission)) return false
    if (entry.featureKey && !auth.hasFeature(entry.featureKey)) return false
    return true
  }

  const navItems = computed<NavItem[]>(() =>
    MENU.flatMap((item): NavItem[] => {
      if (!isGroup(item)) {
        return allowed(item)
          ? [
              {
                label: item.label,
                icon: item.icon ?? 'pi pi-circle',
                routeName: item.routeName,
                routeNames: [item.routeName],
                badgeKeys: item.badgeKey ? [item.badgeKey] : [],
              },
            ]
          : []
      }

      const tabs = item.tabs.filter(allowed)

      if (!tabs.length) return []

      return [
        {
          label: item.label,
          icon: item.icon,
          // La entrada lleva a la primera pestaña que esta persona puede ver.
          routeName: tabs[0].routeName,
          routeNames: tabs.map((t) => t.routeName),
          badgeKeys: tabs.flatMap((t) => (t.badgeKey ? [t.badgeKey] : [])),
          tabs: tabs.map((t) => ({ label: t.label, routeName: t.routeName, badgeKey: t.badgeKey })),
        },
      ]
    }),
  )

  /** El grupo de la pantalla abierta, si tiene más de una pestaña: sus pestañas van arriba. */
  const currentTabs = computed<NavTab[]>(() => {
    const grupo = navItems.value.find((i) => i.routeNames.includes(String(route.name)))
    return grupo?.tabs && grupo.tabs.length > 1 ? grupo.tabs : []
  })

  function isActive(item: NavItem): boolean {
    return item.routeNames.includes(String(route.name))
  }

  return { navItems, currentTabs, isActive }
}
