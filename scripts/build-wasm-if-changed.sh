#!/usr/bin/env bash
# Build the Rust/WASM engine only when the source has changed since the last build.
#
# A SHA-256 digest of wasm-engine/src/** is stored in .wasm-build-stamp.
# If the stamp matches the current sources, the build is skipped entirely so
# that `npm run dev` stays fast during front-end–only iteration.
#
# Force a rebuild:
#   rm .wasm-build-stamp && npm run build:wasm
#
# Skip the stamp check (always rebuild):
#   FORCE_WASM=1 npm run dev

set -euo pipefail

STAMP_FILE=".wasm-build-stamp"
WASM_SRC="wasm-engine/src"
WASM_TOML="wasm-engine/Cargo.toml"
OUT_DIR="src/wasm/pkg"

# If the caller requests a forced rebuild, skip the stamp logic.
if [[ "${FORCE_WASM:-}" == "1" ]]; then
  echo "[build-wasm] FORCE_WASM=1 – rebuilding unconditionally"
  wasm-pack build wasm-engine --target bundler --out-dir "../${OUT_DIR}" --out-name wifi_planner_wasm
  exit 0
fi

# Compute a hash of all Rust source files + Cargo.toml.
compute_hash() {
  find "${WASM_SRC}" -type f -name "*.rs" | sort | xargs cat "${WASM_TOML}" | sha256sum | cut -d' ' -f1
}

CURRENT_HASH="$(compute_hash)"

# Check if the output exists AND the stamp matches.
if [[ -f "${STAMP_FILE}" && -d "${OUT_DIR}" ]]; then
  STORED_HASH="$(cat "${STAMP_FILE}")"
  if [[ "${CURRENT_HASH}" == "${STORED_HASH}" ]]; then
    echo "[build-wasm] Sources unchanged (${CURRENT_HASH:0:12}…) – skipping wasm-pack build."
    exit 0
  fi
fi

echo "[build-wasm] Sources changed – running wasm-pack…"
wasm-pack build wasm-engine --target bundler --out-dir "../${OUT_DIR}" --out-name wifi_planner_wasm

echo "${CURRENT_HASH}" > "${STAMP_FILE}"
echo "[build-wasm] Done. Stamp updated."
