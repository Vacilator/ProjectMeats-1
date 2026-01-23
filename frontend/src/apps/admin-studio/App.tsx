import React, { useEffect, useState } from 'react';

interface AppProps {}

const App: React.FC<AppProps> = () => {
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

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

  return (
    <div className="h-screen w-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          System Blueprint Studio
        </h1>
        <p className="text-xl text-gray-600 mb-2">
          Blueprint ID: <code className="bg-gray-200 px-2 py-1 rounded">{blueprintId || 'Not Set'}</code>
        </p>
        <p className="text-sm text-gray-500">
          CSRF Token: {csrfToken ? '✅ Present' : '❌ Missing'}
        </p>
        <div className="mt-8 text-gray-400">
          <p>Phase 3.1: Frontend Bridge Initialized</p>
          <p className="text-xs mt-2">React 19 + Vite + Django Integration</p>
        </div>
      </div>
    </div>
  );
};

export default App;
