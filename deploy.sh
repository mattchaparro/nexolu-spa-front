#!/usr/bin/env bash
#
# Deploy de nexolu-spa-front al droplet legacy `nexolu`.
#
#   bash deploy.sh              build local + subida + swap atomico
#   bash deploy.sh rollback     vuelve a la release anterior, sin rebuild
#   bash deploy.sh estado       que hay desplegado ahora mismo
#
# CORRE DESDE TU MAQUINA, NO DESDE EL DROPLET.
#
# Es la diferencia con nexolu-pos-front, que compila en el servidor dentro de
# un contenedor con tope de memoria. Ese droplet tiene 2 cores; este tiene
# UNO, compartido con MySQL y con el php-fpm que sirve pos.nexolu.co en
# produccion. pos-saas/scripts/pos_deploy.sh lo midio: compilar ahi degrada
# las requests en vivo entre 100 y 800 veces. Asi que el servidor nunca
# ejecuta Node -- solo recibe archivos ya construidos.
#
# Del patron de pos-front si se conservan las dos propiedades que importan:
#
#   1. EL CLIENTE NUNCA VE UN BUILD A MEDIAS. Cada deploy va a
#      releases/<timestamp>/ y recien al final se cambia el symlink `current`
#      con un rename atomico. Sin ventana de mantenimiento.
#
#   2. SE PUEDE VOLVER ATRAS. Se conservan las ultimas RETENER releases y
#      `rollback` reapunta `current` en un instante.
set -euo pipefail
cd "$(dirname "$0")"

SERVIDOR="${SPA_FRONT_SERVER:-root@134.122.116.201}"
APP_DIR="${SPA_FRONT_APP_DIR:-/opt/nexolu/nexolu-spa-front}"
URL="${SPA_FRONT_URL:-https://agenda.nexolu.co}"
RETENER="${RETENER:-3}"

# --- Build EN EL SERVIDOR -------------------------------------------------
#
# El repo clonado alla, del que sale el build.
SRC_DIR="${SPA_FRONT_SRC_DIR:-/opt/nexolu/nexolu-spa-front-src}"

NODE_IMAGE="${NODE_IMAGE:-node:22-alpine}"

# Topes del contenedor de build. MEM_LIMIT es RAM real; MEM_SWAP_LIMIT es
# RAM+swap junto (asi lo define Docker, no es swap adicional).
#
# Mas bajos que los de pos-front (1200m/2400m) a proposito: aquel droplet tiene
# 2 GB para el solo, y este tiene 1,9 GB compartidos con el MySQL y el php-fpm
# que sirven pos.nexolu.co en produccion. Con ~780 MB libres, pedir 1200 los
# empuja a swap y el que se pone lento es el monolito.
#
# Si el build se pasa, muere SOLO EL contenedor: el deploy falla limpio y el
# sitio sigue sirviendo la version anterior. Es justo lo que le falto a
# pos-front el 2026-08-28, cuando un build sin tope colgo la maquina entera.
MEM_LIMIT="${MEM_LIMIT:-700m}"
MEM_SWAP_LIMIT="${MEM_SWAP_LIMIT:-1400m}"
NODE_HEAP_MB="${NODE_HEAP_MB:-512}"

# Medio core. pos-front no lo necesita porque su droplet tiene dos; aca hay
# UNO y lo comparte con el monolito en vivo. Sin tope, un build de un minuto
# es un minuto de pos.nexolu.co lento.
BUILD_CPUS="${BUILD_CPUS:-0.5}"

log() { echo "[spa-front] $*"; }
fallar() { echo "[spa-front] ERROR: $*" >&2; exit 1; }

remoto() { ssh "$SERVIDOR" "$@"; }

# ---------------------------------------------------------------------------
# El cambio de symlink se hace con `mv -T`, no con `ln -sfn`: este ultimo
# borra y recrea, dejando una ventana sin destino en la que nginx devuelve
# 404. `mv -T` es un rename(2), asi que el cliente ve una version o la otra.
# ---------------------------------------------------------------------------
APUNTAR='apuntar() { ln -sfn "$2" "$1.nuevo"; mv -T "$1.nuevo" "$1"; }'

estado() {
    remoto "cd '$APP_DIR' 2>/dev/null || exit 0
        echo 'current  -> ' \$(readlink -f current 2>/dev/null || echo '(sin definir)')
        echo 'previous -> ' \$(readlink -f previous 2>/dev/null || echo '(sin definir)')
        echo 'releases:'; ls -1t releases 2>/dev/null | sed 's/^/  /'"
}

verificar() {
    local codigo
    codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$URL/" 2>/dev/null || echo 000)"
    log "curl $URL/ -> $codigo"
    [ "$codigo" = "200" ] || log "AVISO: no devolvio 200. Revisar nginx y, si hace falta: bash deploy.sh rollback"
}

rollback() {
    remoto "set -e; cd '$APP_DIR'; $APUNTAR
        [ -L previous ] || { echo 'no hay release anterior registrada' >&2; exit 1; }
        destino=\$(readlink -f previous)
        [ -f \"\$destino/index.html\" ] || { echo 'la release anterior no tiene index.html' >&2; exit 1; }
        actual=\$(readlink -f current 2>/dev/null || true)
        apuntar current \"\$destino\"
        [ -n \"\$actual\" ] && apuntar previous \"\$actual\"
        echo \"current -> \$(basename \$destino)\""
    verificar
}

# Subir una release. rsync si esta, tar sobre ssh si no.
#
# Git Bash en Windows -- que es donde se compila este front -- NO trae rsync,
# y exigirlo dejaba el deploy sin correr en la unica maquina que puede
# construirlo. tar comprime igual y va por el mismo ssh; lo que se pierde es
# la transferencia incremental, y una release son dos megas.
subir() {
    local origen="$1" destino="$2"

    if command -v rsync >/dev/null 2>&1; then
        rsync -az --checksum "$origen/" "$SERVIDOR:$destino/"
    else
        tar -czf - -C "$origen" . | remoto "tar -xzf - -C '$destino'"
    fi
}

# Las variables que un build de PRODUCCION tiene que llevar horneadas.
#
# Vite las mete en el bundle al compilar: no se leen del servidor, no se pueden
# corregir despues, y su ausencia NO da error -- la app compila igual y
# simplemente le falta algo.
#
# El 2026-09-07 se publico un front sin VITE_AUTH_BASE_URL. La app quedo sin el
# boton "Entrar con Nexolu" y quien entra siempre por ahi se quedo sin puerta,
# sin un solo mensaje de error en ningun lado: el sintoma fue "no puedo entrar",
# y el diagnostico tomo media hora.
#
# Por eso el deploy se detiene ANTES de compilar. Es la unica defensa: despues
# de compilar ya no hay a quien preguntarle.
REQUERIDAS=(
    VITE_API_BASE_URL
    VITE_AUTH_BASE_URL
)

verificar_env() {
    [ -f .env ] || fallar "no hay .env. Copia .env.example y llenalo."

    local faltan=()

    for var in "${REQUERIDAS[@]}"; do
        # Presente Y con valor: `VITE_X=` vacia compila igual y rompe igual.
        if ! grep -qE "^${var}=.+" .env; then
            faltan+=("$var")
        fi
    done

    if [ ${#faltan[@]} -gt 0 ]; then
        echo "[spa-front] ERROR: al .env le faltan variables que el build hornea:" >&2

        for var in "${faltan[@]}"; do
            echo "               $var" >&2
        done

        echo "" >&2
        echo "           Sin ellas la app compila igual y sale a produccion incompleta," >&2
        echo "           sin ningun error visible. Ver .env.example para los valores." >&2

        exit 1
    fi
}

# Publica una release ya construida EN EL SERVIDOR.
#
# Los mismos pasos que el modo local a partir de aqui: verificar antes de
# tocar nada, cambiar `current` con un rename atomico, y no borrar nunca la
# release que `current` o `previous` estan usando.
publicar_desde() {
    local origen="$1" release="$2"

    log "4/6 Copiando a la release $release"
    remoto "mkdir -p '$APP_DIR/releases/$release' && cp -a '$origen/.' '$APP_DIR/releases/$release/'"

    log "5/6 Verificando antes de cambiar nada"
    remoto "test -f '$APP_DIR/releases/$release/index.html'" \
        || fallar "la release no tiene index.html; no se cambia current."

    remoto "set -e; cd '$APP_DIR'; $APUNTAR
        actual=\$(readlink -f current 2>/dev/null || true)
        apuntar current '$APP_DIR/releases/$release'
        [ -n \"\$actual\" ] && apuntar previous \"\$actual\" || apuntar previous '$APP_DIR/releases/$release'
        chown -R www-data:www-data '$APP_DIR/releases/$release'"

    log "6/6 Limpiando releases viejas (se conservan $RETENER)"
    remoto "cd '$APP_DIR/releases'
        protegidas=\"\$(readlink -f ../current 2>/dev/null | xargs -r basename) \$(readlink -f ../previous 2>/dev/null | xargs -r basename)\"
        ls -1t | tail -n +$((RETENER + 1)) | while read -r vieja; do
            case \" \$protegidas \" in *\" \$vieja \"*) continue ;; esac
            rm -rf -- \"\$vieja\"
        done"

    log "Listo: release $release"
    verificar
}

# Despliega compilando EN EL SERVIDOR, como hace pos-front.
#
# La diferencia que importa no es tecnica: es que el .env deja de vivir en el
# portatil de quien despliega. Publicar un front al que le falta una variable
# -- que fue el bug del 2026-09-07 -- deja de depender de que esa persona la
# tenga en su maquina.
#
# El modo local sigue existiendo (`bash deploy.sh local`) por si el droplet
# esta apretado o hay que publicar algo sin depender de el.
desplegar_remoto() {

    log "1/6 Actualizando el repo en el servidor"
    remoto "cd '$SRC_DIR' && git fetch -q origin && git reset -q --hard origin/main"

    log "2/6 Verificando el .env del servidor"

    # La misma comprobacion que en local, pero sobre el .env con el que de
    # verdad se compila, que ahora es el de alla.
    local faltan
    faltan="$(remoto "cd '$SRC_DIR' && for v in ${REQUERIDAS[*]}; do grep -qE \"^\${v}=.+\" .env || echo \"\$v\"; done")"

    if [ -n "$faltan" ]; then
        echo "[spa-front] ERROR: al .env de $SRC_DIR le faltan variables:" >&2
        echo "$faltan" | sed 's/^/               /' >&2
        echo "" >&2
        echo "           Sin ellas la app compila igual y sale incompleta." >&2
        exit 1
    fi

    log "3/6 Build en el servidor ($NODE_IMAGE, mem=$MEM_LIMIT, cpus=$BUILD_CPUS)"

    # `nice`/`ionice` ademas del tope de CPU: mientras esto compila, quien
    # tiene que seguir respondiendo rapido es pos.nexolu.co.
    if ! remoto "cd '$SRC_DIR' && ionice -c3 nice -n 19 docker run --rm \
        --name spa-front-build \
        --user root \
        --memory '$MEM_LIMIT' \
        --memory-swap '$MEM_SWAP_LIMIT' \
        --cpus '$BUILD_CPUS' \
        -e NODE_OPTIONS='--max-old-space-size=$NODE_HEAP_MB' \
        -e CI=true \
        -v '$SRC_DIR':/app \
        -w /app \
        '$NODE_IMAGE' \
        sh -c 'rm -rf dist && npm ci --no-audit --no-fund && npm run build'"
    then
        fallar "el build fallo (o lo mato el tope de memoria). NO se toco 'current': el sitio sigue sirviendo la version anterior."
    fi

    remoto "test -f '$SRC_DIR/dist/index.html'" \
        || fallar "el build termino sin error pero no dejo dist/index.html."

    publicar_desde "$SRC_DIR/dist" "$(date +%Y%m%d-%H%M%S)"
}

desplegar() {

    log "0/5 Verificando el .env"
    verificar_env

    log "1/5 Build local (vue-tsc + vite)"
    npm run build

    [ -f dist/index.html ] || fallar "el build no genero dist/index.html."

    local release
    release="$(date +%Y%m%d-%H%M%S)"

    log "2/5 Subiendo release $release"
    remoto "mkdir -p '$APP_DIR/releases/$release'"
    # Sin --delete: cada release es un directorio nuevo y vacio.
    subir dist "$APP_DIR/releases/$release"

    log "3/5 Verificando lo subido antes de cambiar nada"
    remoto "test -f '$APP_DIR/releases/$release/index.html'" \
        || fallar "la release subida no tiene index.html; no se cambia current."

    log "4/5 Cambiando current (rename atomico)"
    remoto "set -e; cd '$APP_DIR'; $APUNTAR
        actual=\$(readlink -f current 2>/dev/null || true)
        apuntar current '$APP_DIR/releases/$release'
        [ -n \"\$actual\" ] && apuntar previous \"\$actual\" || apuntar previous '$APP_DIR/releases/$release'
        chown -R www-data:www-data '$APP_DIR/releases/$release'"

    log "5/5 Limpiando releases viejas (se conservan $RETENER)"
    # Nunca borra la que `current` o `previous` estan usando.
    remoto "cd '$APP_DIR/releases'
        protegidas=\"\$(readlink -f ../current 2>/dev/null | xargs -r basename) \$(readlink -f ../previous 2>/dev/null | xargs -r basename)\"
        ls -1t | tail -n +$((RETENER + 1)) | while read -r vieja; do
            case \" \$protegidas \" in *\" \$vieja \"*) continue ;; esac
            rm -rf -- \"\$vieja\"
        done"

    log "Listo: release $release"
    verificar
}

case "${1:-deploy}" in
    # Por defecto se compila EN EL SERVIDOR: es donde vive el .env de
    # produccion, y asi publicar no depende de la maquina de nadie.
    deploy|remoto) desplegar_remoto ;;
    local) desplegar ;;
    rollback) rollback ;;
    estado|status) estado ;;
    *) fallar "uso: bash deploy.sh [deploy|local|rollback|estado]" ;;
esac
