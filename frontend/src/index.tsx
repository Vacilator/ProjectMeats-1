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
import {
  getChunkRecoveryMessage,
  importWithChunkRecovery,
  isChunkLoadError,
  reloadApplication,
} from './utils/chunkLoadRecovery';
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

  try {
    const [{ default: App }] = await Promise.all([
      importWithChunkRecovery(() => import('./App'), 'App'),
    ]);

    root.render(
      <React.StrictMode>
        <Sentry.ErrorBoundary fallback={<div style={{ padding: 24 }}>Something went wrong.</div>}>
          <App />
        </Sentry.ErrorBoundary>
      </React.StrictMode>
    );

    registerProjectMeatsServiceWorker();
  } catch (error) {
    const chunkRecoveryMessage =
      getChunkRecoveryMessage(error) ||
      'The application failed to start. Reload the page to try again.';

    root.render(
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'rgb(var(--color-bg-secondary))',
        }}
      >
        <div
          style={{
            maxWidth: 560,
            width: '100%',
            border: '1px solid rgb(var(--color-border))',
            borderRadius: 16,
            background: 'rgb(var(--color-bg-primary))',
            padding: 24,
            boxSizing: 'border-box',
          }}
        >
          <h1 style={{ marginTop: 0 }}>Unable to load Meats Central</h1>
          <p style={{ color: 'rgb(var(--color-text-secondary))' }}>{chunkRecoveryMessage}</p>
          <button
            type="button"
            onClick={() =>
              reloadApplication(isChunkLoadError(error) ? 'bootstrap-chunk-retry' : 'bootstrap-retry')
            }
            style={{
              border: 'none',
              borderRadius: 8,
              padding: '10px 16px',
              background: 'rgb(var(--color-primary))',
              color: 'rgb(var(--color-primary-foreground))',
              cursor: 'pointer',
            }}
          >
            Reload application
          </button>
        </div>
      </div>
    );
  }
}

void bootstrapApplication();
