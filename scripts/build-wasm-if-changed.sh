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

have_wasm_pack() {
  command -v wasm-pack >/dev/null 2>&1
}

have_prebuilt_pkg() {
  [[ -f "${OUT_DIR}/wifi_planner_wasm_bg.wasm" && -f "${OUT_DIR}/wifi_planner_wasm_bg.js" ]]
}

# If the caller requests a forced rebuild, skip the stamp logic.
if [[ "${FORCE_WASM:-}" == "1" ]]; then
  if ! have_wasm_pack; then
    echo "[build-wasm] ERROR: FORCE_WASM=1 requires wasm-pack, but it is not installed." >&2
    exit 127
  fi
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
if have_wasm_pack; then
  wasm-pack build wasm-engine --target bundler --out-dir "../${OUT_DIR}" --out-name wifi_planner_wasm
else
  if have_prebuilt_pkg; then
    echo "[build-wasm] wasm-pack not found; using committed prebuilt artifacts in ${OUT_DIR}."
    echo "[build-wasm] Install wasm-pack to regenerate WASM from local Rust changes."
  else
    echo "[build-wasm] ERROR: wasm-pack not found and no prebuilt artifacts in ${OUT_DIR}." >&2
    exit 127
  fi
fi

echo "${CURRENT_HASH}" > "${STAMP_FILE}"
echo "[build-wasm] Done. Stamp updated."
