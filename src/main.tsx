import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initPullToRefreshGuard } from './lib/native-bridge';
import './index.css';

// A swipe inside an open dialog must scroll the dialog — never trip the
// Android shell's pull-to-refresh and reload the page (see
// src/lib/native-bridge.ts).
initPullToRefreshGuard();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find root element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
