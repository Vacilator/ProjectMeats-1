import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App';

// Make search diagnostic available in browser console
import './utils/searchDiagnostic';

// Initialize Sentry if DSN is configured
if (window.ENV?.SENTRY_DSN && window.ENV?.SENTRY_ENABLED !== 'false') {
  console.log('[Sentry] Initializing with DSN:', window.ENV.SENTRY_DSN.substring(0, 20) + '...');
  Sentry.init({
    dsn: window.ENV.SENTRY_DSN,
    environment: window.ENV.ENVIRONMENT || 'development',
    integrations: [
      new Sentry.BrowserTracing(),
      new Sentry.Replay({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: 0.1, // Capture 10% of transactions
    // Session Replay
    replaysSessionSampleRate: 0.1, // Sample 10% of sessions
    replaysOnErrorSampleRate: 1.0, // Sample 100% of sessions with errors
  });
  console.log('[Sentry] Initialized successfully');
} else {
  console.log('[Sentry] Not initialized - DSN:', !!window.ENV?.SENTRY_DSN, 'Enabled:', window.ENV?.SENTRY_ENABLED);
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
