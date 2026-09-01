# Cómo se verifica este front

Tres comandos, y cada uno atrapa una clase distinta de error. Los tres, siempre,
antes de empujar.

```bash
npm run type-check && npm run test && npm run build
```

## `npm run type-check` — los tipos

`vue-tsc --noEmit`. Atrapa tipos que no cuadran, props que faltan, campos que la
API dejó de mandar.

**Lo que NO ve: las plantillas.** No las compila. Ese hueco ya costó dos
pantallas rotas en producción.

## `npm run test` — el comportamiento

Vitest. Cubre lo que se rompe en silencio, no lo que revienta:

- **El armado de FormData** (`resourceFormData`, `expenseFormData`). Acá el
  formulario dice "guardado", el servidor no cambia nada, y sólo se descubre
  volviendo a abrir la ficha. Se rompió dos veces así.
- **Las reglas del selector de sede.** Están repartidas en cuatro pantallas, y
  una copia desincronizada deja cerrar una caja que abarca dos cajones.
- **La aritmética de la rejilla.** Un error ahí no revienta nada: sólo pinta las
  citas corridas media hora, y una cita pintada donde no va es peor que una que
  no se pinta, porque nadie la revisa.
- **Que toda vista del router compile** (`src/router/routes.spec.ts`). Es el
  guardia rápido contra el error de plantilla, y dice cuál vista.

## `npm run build` — todo lo demás

`vite build` compila las plantillas de verdad, incluidos los componentes que no
cuelgan de ninguna ruta. Es la red de seguridad final.

## El error que motivó todo esto

Al correr Prettier, un manejador de dos sentencias quedó partido en dos líneas
sin punto y coma:

```html
@booked="
  pick = null
  notify('Cita agendada.', 'success')
"
```

Vue rechaza eso al compilar la plantilla. `/agenda` devolvía 500 desde Vite y no
cargaba — con síntoma de *"no pudimos iniciar sesión"*, porque el redirect
después de entrar era justo a esa vista. El typecheck no lo vio. Se empujó así.

Cuando monté las pruebas, la de rutas encontró **una segunda pantalla rota igual**
(`/equipo`) que llevaba días empujada sin que nadie lo notara.

**La regla, entonces: un manejador en línea hace UNA cosa.** Con más de una
sentencia, va a una función con nombre. Busqué una regla de ESLint que lo
impidiera y no existe en `eslint-plugin-vue` — así que la defensa son las
pruebas y el build, no el linter.
