import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

/**
 * Preset de PrimeVue basado en Aura, ajustado para que el color "primary"
 * del tema (usado por todos los componentes: foco, boton primario, checked
 * states, highlight de listas, etc.) sea el indigo de marca de Nexolu UI en
 * vez del emerald por defecto de Aura. `secondary` no se sobreescribe: Aura
 * ya lo resuelve sobre la escala `surface`, que a su vez usa slate en modo
 * claro - coincide con el neutro del sistema de color (ver style.css).
 */
export const nexoluPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{indigo.50}',
      100: '{indigo.100}',
      200: '{indigo.200}',
      300: '{indigo.300}',
      400: '{indigo.400}',
      500: '{indigo.500}',
      600: '{indigo.600}',
      700: '{indigo.700}',
      800: '{indigo.800}',
      900: '{indigo.900}',
      950: '{indigo.950}',
    },
  },
  components: {
    // Aura por defecto pinta el estado "checked" con fondo blanco
    // (togglebutton.content.checked.background) sobre un track gris claro -
    // en tarjetas blancas se pierde casi por completo la idea de
    // seleccionado. Lo forzamos a indigo solido (texto/icono blanco), igual
    // que cualquier otro estado "activo" de Nexolu UI (ver NxToggleButton).
    togglebutton: {
      root: {
        checkedBackground: '{primary.600}',
        checkedBorderColor: '{primary.600}',
        checkedColor: '#ffffff',
      },
      icon: {
        checkedColor: '#ffffff',
      },
      content: {
        checkedBackground: 'transparent',
        checkedShadow: 'none',
      },
    },
    // El boton "outline" (severity secondary) de Aura trae texto/borde gris
    // claro pensado para vivir sobre una tarjeta blanca - no tiene token de
    // background propio (el outlined queda transparente por diseño, ver
    // node_modules/primevue/button: ninguna regla de background para esa
    // variante). Varias pantallas lo usan flotando directo sobre el fondo
    // gris de la app (ej. "Edición masiva" en Catalogo) y el texto claro se
    // pierde. El fondo blanco se agrega aparte con Tailwind en NxButton.vue
    // (no hay token que tocar aca para eso); esto solo oscurece el texto.
    button: {
      outlined: {
        secondary: {
          color: '{surface.700}',
          borderColor: '{surface.300}',
        },
      },
    },
    // Aura le pone a las flechas de scroll de los tabs (navButton) un
    // box-shadow con 50px de spread para "desvanecer" el texto de la
    // pestaña que queda debajo - pensado para tablists anchos. En un modal
    // angosto (ej. PaymentModal con 4 tabs) ese halo se extiende tanto que
    // opaca las pestañas vecinas, no solo la que está bajo la flecha. Se
    // reduce el spread para que solo tape lo que la flecha realmente cubre.
    tabs: {
      navButton: {
        shadow: '0px 0px 8px 8px light-dark(rgba(255, 255, 255, 0.9), color-mix(in srgb, {content.background}, transparent 10%))',
      },
    },
  },
})
