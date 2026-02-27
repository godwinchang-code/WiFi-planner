import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { WasmProvider } from './context/WasmContext.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* WasmProvider eagerly loads the Rust/WASM propagation engine on page load */}
    <WasmProvider>
      <App />
    </WasmProvider>
  </React.StrictMode>,
);
