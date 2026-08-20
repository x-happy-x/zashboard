#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
artifact=${1:-}
router=${ROUTER:-root@192.168.1.1}
port=${ROUTER_PORT:-222}

if [[ -z "$artifact" || ! -f "$artifact" ]]; then
  echo "Usage: deploy.sh <zashboard.tar.gz>" >&2
  exit 2
fi

checksum_file="$artifact.sha256"
[[ -f "$checksum_file" ]] || {
  echo "Checksum file not found: $checksum_file" >&2
  exit 1
}

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
cp "$script_dir/install.sh" "$stage/install.sh"
cp "$artifact" "$stage/zashboard.tar.gz"
cp "$checksum_file" "$stage/zashboard.tar.gz.sha256"

echo "Uploading to $router:$port. The router may prompt for its SSH password."
tar -C "$stage" -cf - install.sh zashboard.tar.gz zashboard.tar.gz.sha256 | \
  ssh -p "$port" "$router" \
    'set -e; d=$(mktemp -d /tmp/zashboard-deploy.XXXXXX); trap '\''rm -rf "$d"'\'' EXIT; tar -xf - -C "$d"; sh "$d/install.sh" "$d/zashboard.tar.gz"'
