import React, { useEffect, useState } from 'react';
import SchemaEditor from './components/SchemaEditor';
import WorkflowCanvas from './components/WorkflowCanvas';

interface AppProps {}

const App: React.FC<AppProps> = () => {
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'schema' | 'canvas'>('schema');

  useEffect(() => {
    // Get blueprint ID from root element data attribute
    const rootElement = document.getElementById('root');
    const bpId = rootElement?.getAttribute('data-blueprint-id');
    setBlueprintId(bpId || null);

    // Get CSRF token from meta tag
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    const token = metaTag?.getAttribute('content');
    setCsrfToken(token || null);
  }, []);

  if (!blueprintId) {
    return (
      <div className="h-screen w-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">❌ Error</h1>
          <p className="text-gray-600">No Blueprint ID provided</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              System Blueprint Studio
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Editing Version: <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{blueprintId}</code>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-green-600">✅ CSRF Token Active</span>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              💾 Save Changes
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'schema'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📊 Data Schema (Excel View)
          </button>
          <button
            onClick={() => setActiveTab('canvas')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'canvas'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🔄 Workflow Canvas (Visual)
          </button>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {activeTab === 'schema' && (
          <SchemaEditor blueprintId={blueprintId} csrfToken={csrfToken || ''} />
        )}
        {activeTab === 'canvas' && (
          <WorkflowCanvas blueprintId={blueprintId} csrfToken={csrfToken || ''} />
        )}
      </main>
    </div>
  );
};

export default App;
