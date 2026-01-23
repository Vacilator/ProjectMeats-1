import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SchemaEditor from './components/SchemaEditor';
import WorkflowCanvas from './components/WorkflowCanvas';
import '../../index.css'; // Import main app styles (CSS variables)

// Create QueryClient for data fetching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Get the root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

// Create React root and render the app
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/system-config/studio/:blueprintId/schema" element={<SchemaEditor />} />
          <Route path="/admin/system-config/studio/:blueprintId/workflow" element={<WorkflowCanvas />} />
          <Route path="/admin/system-config/studio/:blueprintId" element={<Navigate to="schema" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
