import { useWasmEngine } from '../../context/WasmContext';

/**
 * Small badge shown in the sidebar header indicating the WASM engine status.
 *
 *  • Pulsing grey dot  → loading
 *  • Solid amber dot   → error / JS fallback
 *  • Solid green dot   → WASM engine ready
 */
export function WasmBadge() {
  const { status, error } = useWasmEngine();

  if (status === 'loading') {
    return (
      <span
        title="Loading WASM propagation engine…"
        className="flex items-center gap-1 text-xs text-primary-200 select-none"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-200 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-300" />
        </span>
        WASM
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span
        title={`WASM engine unavailable – using JS fallback.\n${error ?? ''}`}
        className="flex items-center gap-1 text-xs text-amber-300 select-none cursor-help"
      >
        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
        JS
      </span>
    );
  }

  // ready
  return (
    <span
      title="Rust/WASM propagation engine active"
      className="flex items-center gap-1 text-xs text-green-300 select-none"
    >
      <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
      WASM
    </span>
  );
}
