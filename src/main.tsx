import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/dashboard.css';

// Registrace Service Workeru pro plný offline režim PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.info('[PWA] Service Worker úspěšně registrován:', registration.scope);
      })
      .catch((error) => {
        console.warn('[PWA] Registrace Service Workeru selhala:', error);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
