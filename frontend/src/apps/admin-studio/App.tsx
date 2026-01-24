import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import Editor from './pages/Editor';

// Base URL for the Studio app
const BASENAME = '/admin/system-config/studio';

const App: React.FC = () => {
  // Check if we have a pre-loaded blueprint ID from Django template
  const rootElement = document.getElementById('root');
  const initialBlueprintId = rootElement?.getAttribute('data-blueprint-id');

  return (
    <BrowserRouter basename={BASENAME}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/:blueprintId" element={<Editor />} />
        {/* If loaded with initial ID (direct link handled by Django), render Editor */}
        {initialBlueprintId && (
          <Route path="/" element={<Navigate to={`/${initialBlueprintId}`} replace />} />
        )}
      </Routes>
    </BrowserRouter>
  );
};

export default App;
