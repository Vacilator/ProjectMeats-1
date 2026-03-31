import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import * as Sentry from '@sentry/react';
import App from './App';

// Make search diagnostic available in browser console
import './utils/searchDiagnostic';

import { initSentry } from './utils/sentry';
import { initGlobalErrorHandlers } from './utils/globalErrorHandlers';

initSentry();
initGlobalErrorHandlers('frontend');

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<div style={{ padding: 24 }}>Something went wrong.</div>}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
