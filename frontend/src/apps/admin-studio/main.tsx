import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initGlobalErrorHandlers } from '../../utils/globalErrorHandlers';
import { logger } from '@/utils/logger';

initGlobalErrorHandlers('admin-studio');

// Get the root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  logger.error('Root element not found - Studio app cannot mount');
} else {
  // Create React root and render the Studio app
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
