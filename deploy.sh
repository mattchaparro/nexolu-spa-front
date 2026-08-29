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
URL="${SPA_FRONT_URL:-https://spa.nexolu.co}"
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

desplegar() {
    command -v rsync >/dev/null 2>&1 || fallar "hace falta rsync."

    log "1/5 Build local (vue-tsc + vite)"
    npm run build

    [ -f dist/index.html ] || fallar "el build no genero dist/index.html."

    local release
    release="$(date +%Y%m%d-%H%M%S)"

    log "2/5 Subiendo release $release"
    remoto "mkdir -p '$APP_DIR/releases/$release'"
    # Sin --delete: cada release es un directorio nuevo y vacio.
    rsync -az --checksum dist/ "$SERVIDOR:$APP_DIR/releases/$release/"

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
