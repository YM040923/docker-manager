#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_FNPACK="$ROOT/tools/fnpack/fnpack"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required to build the fnOS package" >&2
  exit 1
fi

if [ -z "${FNPACK:-}" ] && [ -z "${FNOS_FNPACK:-}" ] && ! command -v fnpack >/dev/null 2>&1 && [ ! -x "$LOCAL_FNPACK" ]; then
  "$ROOT/scripts/download-fnpack.sh" linux amd64
fi

cd "$ROOT"
pnpm install --frozen-lockfile
pnpm build:fnos

FPK="$(find "$ROOT/packaging/fnos-native/ym040923.docker-manager" -maxdepth 1 -name '*.fpk' -print -quit)"
if [ -z "$FPK" ]; then
  echo "fnOS package was not generated" >&2
  exit 1
fi

echo "Built fnOS package: $FPK"
