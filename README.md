# nexolu-spa-front

SPA de agenda para spas de uñas, barberías y estética. Consume **solo**
`nexolu-spa-api` por REST puro, sin SSR.

## Stack

Vue 3.5 (Composition API) · TypeScript · Vite · Vue Router · Pinia ·
TanStack Query · PrimeVue (preset Aura + indigo de marca) · Tailwind v4 ·
VeeValidate + Zod · Sentry

Es el mismo esqueleto de `nexolu-pos-front`: continuidad de marca y de
convenciones entre productos. Lo que cambia es el dominio, no la plomería.

## Arrancar

```bash
npm install
npm run dev
```

Necesita `nexolu-spa-api` corriendo. Copia `.env.example` a `.env` y ajusta
`VITE_API_BASE_URL`.

## Convenciones que no se rompen

**Ninguna pantalla importa PrimeVue directo.** Todo pasa por los envoltorios de
`src/ui` (`NxButton`, `NxDataTable`, `NxModal`…). Es lo que permite cambiar de
librería de componentes sin tocar 40 vistas.

**Pinia solo para sesión.** `auth.store.ts` y `flash.store.ts`. Todo estado de
servidor —listados, mutaciones— vive en TanStack Query, vía composables por
módulo. `queryClient.clear()` se llama en cada cambio de identidad para no
arrastrar caché entre negocios.

**Permisos y features se leen de una sola fuente.** El guard del router, el menú
y el backend miran lo mismo. Duplicar la lógica en el menú es como se termina
mostrando una opción que después rebota con un 403.

**Un módulo es `views/ + components/ + composables/ + services/`.** Sin
excepciones, para que cualquiera sepa dónde buscar.

## Estructura

```
src/
  ui/          envoltorios de PrimeVue - la única puerta a la librería
  services/    cliente HTTP, almacenamiento de token, queryClient
  stores/      sesión y mensajes flash
  theme/       preset de PrimeVue (indigo + slate)
  layouts/     AppLayout (autenticado) y AuthLayout
  modules/     un directorio por módulo de producto
```

## Autenticación

`POST /api/v1/login` (Sanctum) → token en `localStorage` → `Authorization:
Bearer` en cada request. Un 401 dispara `clearSession()` —limpia token, usuario
y caché de TanStack Query— y redirige a login.

## Estado

Fase 00 del blueprint: esqueleto y router en su sitio. Las vistas de cada
módulo se agregan en la fase que les toca.
