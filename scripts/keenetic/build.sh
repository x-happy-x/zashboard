#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
output_dir=${OUTPUT_DIR:-"$repo_root/dist/keenetic"}
font=${FONT:-cdn}

for command in git node pnpm tar gzip sha256sum; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Required command is missing: %s\n' "$command" >&2
    exit 1
  }
done

version=$(cd "$repo_root" && node -p "require('./package.json').version")
commit=$(git -C "$repo_root" rev-parse --short HEAD)
artifact="zashboard-$version-$commit-$font.tar.gz"
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

(
  cd "$repo_root"
  pnpm install --frozen-lockfile
  FONT="$font" pnpm run build
  rm -f dist/CNAME
  tar -C dist -czf "$work_dir/$artifact" .
)

mkdir -p "$output_dir"
rm -f "$output_dir/$artifact" "$output_dir/$artifact.sha256"
mv "$work_dir/$artifact" "$output_dir/$artifact"

(
  cd "$output_dir"
  sha256sum "$artifact" > "$artifact.sha256"
)

printf 'Created:\n  %s\n  %s\n' "$output_dir/$artifact" "$output_dir/$artifact.sha256"
