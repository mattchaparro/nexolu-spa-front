// Alerta de acciones del sistema (ver src/ui/NxToast.vue, montado una vez
// en App.vue): mensajes cortos y no bloqueantes que confirman algo que
// acaba de pasar ("Producto agregado a la venta"). No reemplaza los
// errores de formulario (prop `error` de NxInput/NxInputNumber/NxSelect) ni
// los banners de error de pantalla completa (submitError en las vistas).
import { useToast } from 'primevue/usetoast'

export type SystemAlertSeverity = 'success' | 'info' | 'warn' | 'error'

export function useSystemAlert() {
  const toast = useToast()

  function notify(message: string, severity: SystemAlertSeverity = 'success'): void {
    toast.add({ severity, summary: message, life: 2200 })
  }

  return { notify }
}
