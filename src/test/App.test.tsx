/**
 * Render / smoke tests for the top-level App shell.
 *
 * The WASM module is mocked so these tests run in jsdom without a real
 * WebAssembly runtime.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import { WasmProvider } from '../context/WasmContext';

// ── Mock the WASM pkg so the module system doesn't try to load the binary ──
vi.mock('../wasm/pkg/wifi_planner_wasm', () => ({
  compute_heatmap: vi.fn(() => ({
    cols: 1,
    rows: 1,
    total_count: 1,
    excellent_count: 1,
    good_count: 0,
    fair_count: 0,
    poor_count: 0,
    no_coverage_count: 0,
    pixels: () => new Uint8ClampedArray(4),
    avg_rssi: () => -55,
    free: () => { /* mock */ },
  })),
  point_rssi: vi.fn(() => -55),
  init_panic_hook: vi.fn(),
}));

function renderApp() {
  return render(
    <WasmProvider>
      <App />
    </WasmProvider>,
  );
}

describe('App shell renders', () => {
  it('renders the sidebar application title', () => {
    renderApp();
    expect(screen.getByText('WiFi Planner')).toBeInTheDocument();
  });

  it('renders the "Network Coverage Planning" subtitle', () => {
    renderApp();
    expect(screen.getByText('Network Coverage Planning')).toBeInTheDocument();
  });

  it('renders the Tools section heading', () => {
    renderApp();
    expect(screen.getByText('Tools')).toBeInTheDocument();
  });

  it('renders the Floor Plan section heading', () => {
    renderApp();
    expect(screen.getByText('Floor Plan')).toBeInTheDocument();
  });

  it('renders the canvas container element', () => {
    const { container } = renderApp();
    // The canvas-container class is on the <main> element in App.tsx
    const canvasArea = container.querySelector('.canvas-container');
    expect(canvasArea).not.toBeNull();
  });

  it('renders the Heatmap toggle', () => {
    renderApp();
    expect(screen.getByText('Heatmap')).toBeInTheDocument();
  });

  it('renders AP placement hint when ap tool is inactive (select mode by default)', () => {
    renderApp();
    // Empty AP list placeholder should be present
    expect(screen.getByText(/No access points placed yet/i)).toBeInTheDocument();
  });
});
