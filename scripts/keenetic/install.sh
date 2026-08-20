#!/bin/sh
set -eu

CONFIG_FILE=${CONFIG_FILE:-/opt/etc/mihomo/config.yaml}
CONFIG_DIR=${CONFIG_DIR:-/opt/etc/mihomo}
BACKUP_DIR=${BACKUP_DIR:-/opt/etc/mihomo/backup/ui}
TARGET_DIR=${TARGET_DIR:-}
ALLOW_UNVERIFIED=${ALLOW_UNVERIFIED:-0}
ALLOW_OUTSIDE_CONFIG=${ALLOW_OUTSIDE_CONFIG:-0}
SOURCE=${1:-}
EXPECTED_SHA256=${2:-}
LOCK_DIR=/tmp/zashboard-keenetic-install.lock
WORK_DIR=

usage() {
    cat <<'EOF'
Usage: install.sh <zashboard.tar.gz path-or-url> [sha256]

The target is read from external-ui in /opt/etc/mihomo/config.yaml.
Set TARGET_DIR to override it explicitly.
EOF
}

cleanup() {
    [ -n "$WORK_DIR" ] && rm -rf "$WORK_DIR"
    rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM HUP

[ -n "$SOURCE" ] || {
    usage >&2
    exit 2
}

[ "$(id -u)" = "0" ] || {
    echo "Run this installer as root." >&2
    exit 1
}

[ -f "$CONFIG_FILE" ] || {
    echo "Mihomo config not found: $CONFIG_FILE" >&2
    exit 1
}

config_dir=$CONFIG_DIR

if [ -z "$TARGET_DIR" ]; then
    external_ui=$(sed -n 's/^[[:space:]]*external-ui:[[:space:]]*//p' "$CONFIG_FILE" | head -1)
    external_ui=$(printf '%s' "$external_ui" | sed 's/^['\''"]//; s/['\''"]$//')
    [ -n "$external_ui" ] || {
        echo "external-ui is not configured; set TARGET_DIR explicitly." >&2
        exit 1
    }
    case "$external_ui" in
        /*) TARGET_DIR=$external_ui ;;
        ./*) TARGET_DIR="$config_dir/${external_ui#./}" ;;
        *) TARGET_DIR="$config_dir/$external_ui" ;;
    esac
fi

case "/$TARGET_DIR/" in
    */../*|*/./*)
        echo "Refusing TARGET_DIR with path traversal: $TARGET_DIR" >&2
        exit 1
        ;;
esac

case "$TARGET_DIR" in
    /|/opt|/opt/etc|/opt/etc/mihomo)
        echo "Refusing unsafe TARGET_DIR: $TARGET_DIR" >&2
        exit 1
        ;;
esac

if [ "$ALLOW_OUTSIDE_CONFIG" != "1" ]; then
    case "$TARGET_DIR" in
        "$config_dir"/*) ;;
        *)
            echo "TARGET_DIR is outside $config_dir; set ALLOW_OUTSIDE_CONFIG=1 to permit it." >&2
            exit 1
            ;;
    esac
fi

mkdir "$LOCK_DIR" 2>/dev/null || {
    echo "Another Zashboard installation is already running." >&2
    exit 1
}

WORK_DIR=$(mktemp -d /tmp/zashboard-install.XXXXXX)
archive="$WORK_DIR/zashboard.tar.gz"
checksum_file="$WORK_DIR/zashboard.tar.gz.sha256"
staging="${TARGET_DIR}.new.$$"

fetch() {
    source=$1
    destination=$2
    case "$source" in
        http://*|https://*)
            if command -v curl >/dev/null 2>&1; then
                curl -fL --connect-timeout 20 --max-time 600 -o "$destination" "$source"
            else
                wget -O "$destination" "$source"
            fi
            ;;
        *)
            cp "$source" "$destination"
            ;;
    esac
}

fetch "$SOURCE" "$archive"
[ -s "$archive" ] || {
    echo "Downloaded artifact is empty." >&2
    exit 1
}

if [ -z "$EXPECTED_SHA256" ]; then
    if fetch "${SOURCE}.sha256" "$checksum_file" 2>/dev/null; then
        EXPECTED_SHA256=$(awk 'NR == 1 {print $1}' "$checksum_file")
    fi
fi

if [ -n "$EXPECTED_SHA256" ]; then
    actual_sha256=$(sha256sum "$archive" | awk '{print $1}')
    [ "$actual_sha256" = "$EXPECTED_SHA256" ] || {
        echo "SHA-256 verification failed." >&2
        exit 1
    }
elif [ "$ALLOW_UNVERIFIED" != "1" ]; then
    echo "No SHA-256 checksum was supplied or found next to the artifact." >&2
    exit 1
fi

rm -rf "$staging"
mkdir -p "$staging"
if tar -tzf "$archive" | awk '/^\// || /(^|\/)\.\.($|\/)/ { bad=1 } END { exit bad ? 0 : 1 }'; then
    rm -rf "$staging"
    echo "Artifact contains an unsafe path." >&2
    exit 1
fi
tar -xzf "$archive" -C "$staging"

[ -f "$staging/index.html" ] || {
    echo "Artifact does not contain index.html at its root." >&2
    rm -rf "$staging"
    exit 1
}

timestamp=$(date '+%Y%m%d_%H%M%S')
mkdir -p "$BACKUP_DIR" "$(dirname "$TARGET_DIR")"
backup="$BACKUP_DIR/zashboard.$timestamp"

if [ -e "$TARGET_DIR" ] || [ -L "$TARGET_DIR" ]; then
    mv "$TARGET_DIR" "$backup"
fi

if ! mv "$staging" "$TARGET_DIR"; then
    [ -e "$backup" ] && mv "$backup" "$TARGET_DIR"
    echo "Could not activate the new dashboard; previous files restored." >&2
    exit 1
fi

[ -f "$TARGET_DIR/index.html" ] || {
    rm -rf "$TARGET_DIR"
    [ -e "$backup" ] && mv "$backup" "$TARGET_DIR"
    echo "Post-install validation failed; previous files restored." >&2
    exit 1
}

echo "Zashboard installed at $TARGET_DIR. Mihomo restart is not required."
[ -e "$backup" ] && echo "Backup: $backup"
