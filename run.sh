#!/bin/sh
set -eu
COLLECTION_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
COLLECTION_NODE=$(command -v node || true)
if [ -z "$COLLECTION_NODE" ]; then
  echo 'Install Node.js 24 or later, then run this script again.' >&2
  exit 1
fi
if [ ! -f "$COLLECTION_DIR/node_modules/vite/bin/vite.js" ]; then
  echo 'Run pnpm install in this folder first.' >&2
  exit 1
fi
cd "$COLLECTION_DIR"
"$COLLECTION_NODE" scripts/export-build.mjs
"$COLLECTION_NODE" node_modules/vite/bin/vite.js build
"$COLLECTION_NODE" scripts/prepare-static.mjs
exec "$COLLECTION_NODE" node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port "${PORT:-4173}"
