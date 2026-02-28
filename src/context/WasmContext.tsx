/**
 * WasmContext – provides the WASM propagation engine to the component tree.
 *
 * The engine is loaded eagerly on page load (inside WasmProvider's useEffect),
 * so it is ready before the first heatmap render in most cases.
 * Up to MAX_RETRIES attempts are made with exponential back-off before
 * switching to 'error' status and falling back to the JS simulation path.
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

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [500, 1000, 2000];

async function loadWithRetry(attempt = 0): Promise<WasmPropagationEngine> {
  try {
    const { loadWasmEngine } = await import('../wasm/engine');
    return await loadWasmEngine();
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS_MS[attempt] ?? 2000;
      console.warn(
        `[WiFi Planner] WASM load attempt ${attempt + 1} failed – retrying in ${delay}ms…`,
        err,
      );
      await new Promise<void>(resolve => setTimeout(resolve, delay));
      return loadWithRetry(attempt + 1);
    }
    throw err;
  }
}

export function WasmProvider({ children }: { children: React.ReactNode }) {
  const [engine, setEngine] = useState<WasmPropagationEngine | null>(null);
  const [status, setStatus] = useState<WasmStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadWithRetry()
      .then((eng) => {
        if (cancelled) return;
        setEngine(eng);
        setStatus('ready');
        console.info('[WiFi Planner] WASM propagation engine ready.');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[WiFi Planner] WASM engine failed to load after retries:', msg);
        setError(msg);
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <WasmContext.Provider value={{ engine, status, error }}>
      {children}
    </WasmContext.Provider>
  );
}

// Co-located with WasmProvider intentionally – they share the private WasmContext reference.
// eslint-disable-next-line react-refresh/only-export-components
export function useWasmEngine(): WasmContextValue {
  return useContext(WasmContext);
}
