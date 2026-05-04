import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import * as Sentry from '@sentry/react';

// Make search diagnostic available in browser console
import './utils/searchDiagnostic';

import {
  hydrateRuntimeConfigFromCache,
  persistRuntimeConfigSnapshot,
} from './pwa/runtimeConfigCache';
import { registerProjectMeatsServiceWorker } from './pwa/registerServiceWorker';
import { initSentry } from './utils/sentry';
import { initGlobalErrorHandlers } from './utils/globalErrorHandlers';

const liveRuntimeConfig = window.ENV ? { ...window.ENV } : undefined;

hydrateRuntimeConfigFromCache();
initSentry();
initGlobalErrorHandlers('frontend');

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('ProjectMeats root element not found.');
}

const root = ReactDOM.createRoot(rootElement);

async function bootstrapApplication(): Promise<void> {
  persistRuntimeConfigSnapshot(liveRuntimeConfig);

  const [{ default: App }] = await Promise.all([import('./App')]);

  root.render(
    <React.StrictMode>
      <Sentry.ErrorBoundary fallback={<div style={{ padding: 24 }}>Something went wrong.</div>}>
        <App />
      </Sentry.ErrorBoundary>
    </React.StrictMode>
  );

  registerProjectMeatsServiceWorker();
}

void bootstrapApplication();
