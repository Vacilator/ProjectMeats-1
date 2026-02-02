import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { ConfigDashboard } from './pages/ConfigDashboard';
import { ChoiceListEditor } from './components/ChoiceListEditor';
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
        <Route path="/config" element={<ConfigDashboard />} />
        <Route path="/config/choices" element={<ChoiceListEditorPage />} />
        <Route path="/config/choices/:slug" element={<ChoiceListEditorPage />} />
        <Route path="/:blueprintId" element={<Editor />} />
        {/* If loaded with initial ID (direct link handled by Django), render Editor */}
        {initialBlueprintId && (
          <Route path="/" element={<Navigate to={`/${initialBlueprintId}`} replace />} />
        )}
      </Routes>
    </BrowserRouter>
  );
};

// Wrapper page for ChoiceListEditor with navigation
const ChoiceListEditorPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <a
            href="/admin/system-config/studio/config"
            className="text-gray-500 hover:text-gray-700"
          >
            ← Back to Config
          </a>
          <h1 className="text-xl font-bold text-gray-900">Choice List Editor</h1>
        </div>
      </header>
      <div className="h-[calc(100vh-65px)]">
        <ChoiceListEditor />
      </div>
    </div>
  );
};

export default App;
