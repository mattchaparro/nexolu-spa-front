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
    deploy) desplegar ;;
    rollback) rollback ;;
    estado|status) estado ;;
    *) fallar "uso: bash deploy.sh [deploy|rollback|estado]" ;;
esac
