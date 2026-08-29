import { ref } from 'vue'
import { defineStore } from 'pinia'

import type { SystemAlertSeverity } from '@/composables/useSystemAlert'

// Puente entre codigo que no es un componente (router guard, interceptor de
// axios en services/http/client.ts) y el sistema de toasts (NxToast, que
// necesita useToast() de PrimeVue, solo disponible dentro de un setup()).
// App.vue observa `message` una vez y dispara el toast - ver su watcher.
export const useFlashStore = defineStore('flash', () => {
  const message = ref<string | null>(null)
  const severity = ref<SystemAlertSeverity>('info')

  function set(msg: string, sev: SystemAlertSeverity = 'info'): void {
    message.value = msg
    severity.value = sev
  }

  function clear(): void {
    message.value = null
  }

  return { message, severity, set, clear }
})
