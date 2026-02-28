import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { WasmProvider } from './context/WasmContext.tsx';
import './index.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', color: '#c00' }}>
          <h2>App crashed</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* WasmProvider eagerly loads the Rust/WASM propagation engine on page load */}
      <WasmProvider>
        <App />
      </WasmProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
