import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { ConfigDashboard } from './pages/ConfigDashboard';
import { Metrics } from './pages/Metrics';
import { ChoiceListEditor } from './components/ChoiceListEditor';
import { TenantConfigEditor } from './components/TenantConfigEditor';
import { AuditLogViewer } from './components/AuditLogViewer';
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
        <Route path="/metrics" element={<Metrics />} />
        <Route path="/config/choices" element={<ChoiceListEditorPage />} />
        <Route path="/config/choices/:slug" element={<ChoiceListEditorPage />} />
        <Route path="/config/tenant" element={<TenantConfigEditorPage />} />
        <Route path="/config/tenant/:category" element={<TenantConfigEditorPage />} />
        <Route path="/config/audit" element={<AuditLogPage />} />
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
    <div className="min-h-screen" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
      <header className="shadow-sm border-b" style={{ background: 'rgb(var(--color-bg-primary))' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <a
            href="/admin/system-config/studio/config"
            className="hover:text-[rgb(var(--color-text-secondary))]" style={{ color: 'rgb(var(--color-text-tertiary))' }}
          >
            ← Back to Config
          </a>
          <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>Choice List Editor</h1>
        </div>
      </header>
      <div className="h-[calc(100vh-65px)]">
        <ChoiceListEditor />
      </div>
    </div>
  );
};

// Wrapper page for TenantConfigEditor with navigation
const TenantConfigEditorPage: React.FC = () => {
  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
      <header className="shadow-sm border-b" style={{ background: 'rgb(var(--color-bg-primary))' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <a
            href="/admin/system-config/studio/config"
            className="hover:text-[rgb(var(--color-text-secondary))]" style={{ color: 'rgb(var(--color-text-tertiary))' }}
          >
            ← Back to Config
          </a>
          <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>Tenant Config Editor</h1>
        </div>
      </header>
      <div className="h-[calc(100vh-65px)]">
        <TenantConfigEditor />
      </div>
    </div>
  );
};

// Wrapper page for AuditLogViewer with navigation
const AuditLogPage: React.FC = () => {
  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
      <header className="shadow-sm border-b" style={{ background: 'rgb(var(--color-bg-primary))' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <a
            href="/admin/system-config/studio/config"
            className="hover:text-[rgb(var(--color-text-secondary))]" style={{ color: 'rgb(var(--color-text-tertiary))' }}
          >
            ← Back to Config
          </a>
          <h1 className="text-xl font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>📜 Audit Log</h1>
        </div>
      </header>
      <div className="h-[calc(100vh-65px)]">
        <AuditLogViewer />
      </div>
    </div>
  );
};

export default App;
