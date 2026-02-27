/**
 * WasmContext – provides the WASM propagation engine to the component tree.
 *
 * The engine is loaded eagerly on page load (inside WasmProvider's useEffect),
 * so it is ready before the first heatmap render in most cases.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { WasmPropagationEngine } from '../wasm/engine';

export type WasmStatus = 'loading' | 'ready' | 'error';

type WasmContextValue = {
  engine: WasmPropagationEngine | null;
  status: WasmStatus;
  /** Non-null only when status === 'error' */
  error: string | null;
};

const WasmContext = createContext<WasmContextValue>({
  engine: null,
  status: 'loading',
  error: null,
});

export function WasmProvider({ children }: { children: React.ReactNode }) {
  const [engine, setEngine] = useState<WasmPropagationEngine | null>(null);
  const [status, setStatus] = useState<WasmStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Dynamic import so Vite only loads the WASM bundle after the page is
    // interactive – the import resolves almost immediately from the bundle.
    import('../wasm/engine')
      .then(({ loadWasmEngine }) => loadWasmEngine())
      .then((eng) => {
        setEngine(eng);
        setStatus('ready');
        console.info('[WiFi Planner] WASM propagation engine ready.');
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[WiFi Planner] WASM engine failed to load:', msg);
        setError(msg);
        setStatus('error');
      });
  }, []);

  return (
    <WasmContext.Provider value={{ engine, status, error }}>
      {children}
    </WasmContext.Provider>
  );
}

/** Consume the WASM engine from any component. */
export function useWasmEngine(): WasmContextValue {
  return useContext(WasmContext);
}
