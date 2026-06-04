#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${FNOS_FNPACK_VERSION:-1.2.1}"
PLATFORM="${1:-linux}"
ARCH="${2:-amd64}"
TOOLS_DIR="$ROOT/tools/fnpack"

case "$PLATFORM/$ARCH" in
  linux/amd64)
    ASSET="fnpack-${VERSION}-linux-amd64"
    EXPECTED_SHA256="72d2a4095da676b64510b023731a227b369d80f8079bc45ff8a2f802ec0480c1"
    OUT="$TOOLS_DIR/fnpack"
    ;;
  *)
    echo "Unsupported fnpack target: $PLATFORM/$ARCH" >&2
    exit 1
    ;;
esac

URL="https://static2.fnnas.com/fnpack/$ASSET"
mkdir -p "$TOOLS_DIR"

TMP="$OUT.tmp"
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$URL" -o "$TMP"
elif command -v wget >/dev/null 2>&1; then
  wget -q "$URL" -O "$TMP"
else
  echo "curl or wget is required to download fnpack" >&2
  exit 1
fi

ACTUAL_SHA256="$(sha256sum "$TMP" | awk '{print $1}')"
if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
  echo "fnpack checksum mismatch" >&2
  echo "expected: $EXPECTED_SHA256" >&2
  echo "actual:   $ACTUAL_SHA256" >&2
  rm -f "$TMP"
  exit 1
fi

mv "$TMP" "$OUT"
chmod +x "$OUT"

case "$(uname -s)" in
  Linux*) HOST_PLATFORM="linux" ;;
  MINGW*|MSYS*|CYGWIN*) HOST_PLATFORM="windows" ;;
  Darwin*) HOST_PLATFORM="darwin" ;;
  *) HOST_PLATFORM="unknown" ;;
esac

if [ "$HOST_PLATFORM" = "$PLATFORM" ]; then
  "$OUT" --help >/dev/null
else
  echo "Warning: downloaded $PLATFORM/$ARCH fnpack cannot run on $HOST_PLATFORM; skipping smoke check." >&2
fi

echo "Downloaded fnpack $VERSION to $OUT"
