import React, { useEffect, useState } from 'react';
import axios from 'axios';
import SchemaEditor from '../components/SchemaEditorSimple';
// Use UnifiedFlowEditor instead of WorkflowCanvas
import { UnifiedFlowEditor } from '../../../components/FlowEditor';
import { VersionHistory } from '../components/VersionHistory';

import { useParams, useNavigate } from 'react-router-dom';

interface EditorProps {}

const Editor: React.FC<EditorProps> = () => {
  const { blueprintId: paramBlueprintId } = useParams<{ blueprintId: string }>();
  const [blueprintId, setBlueprintId] = useState<string | null>(paramBlueprintId || null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'schema' | 'canvas' | 'history'>('schema');
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [blueprintName, setBlueprintName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    // Get blueprint ID from URL params or data attribute
    const bpId = paramBlueprintId || document.getElementById('root')?.getAttribute('data-blueprint-id');
    setBlueprintId(bpId || null);

    // Get CSRF token from cookie
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };
    const token = getCookie('csrftoken') || 
                  document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    setCsrfToken(token || null);

    // Fetch blueprint status
    if (bpId && token) {
      fetchBlueprintStatus(bpId, token);
    }
  }, []);

  const fetchBlueprintStatus = async (id: string, token: string) => {
    try {
      setLoading(true);
      const response = await axios.get(
        `/admin/system-config/api/studio/versions/${id}/`,
        {
          headers: {
            'X-CSRFToken': token,
            'Content-Type': 'application/json',
          },
        }
      );
      setIsPublished(response.data.is_published || false);
      setBlueprintName(response.data.blueprint_name || '');
    } catch (error) {
      console.error('Error fetching blueprint status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!blueprintId || !csrfToken) return;

    if (confirm('Publish this workflow? It will become available to all tenant users.')) {
      try {
        setPublishing(true);
        await axios.post(
          `/admin/system-config/api/studio/versions/${blueprintId}/publish/`,
          {},
          {
            headers: {
              'X-CSRFToken': csrfToken,
              'Content-Type': 'application/json',
            },
          }
        );
        setIsPublished(true);
        alert('✅ Workflow published successfully!');
      } catch (error: any) {
        console.error('Error publishing:', error);
        alert(`❌ Failed to publish: ${error.message}`);
      } finally {
        setPublishing(false);
      }
    }
  };

  const handleUnpublish = async () => {
    if (!blueprintId || !csrfToken) return;

    if (confirm('Unpublish this workflow? It will be removed from the catalog.')) {
      try {
        setPublishing(true);
        await axios.post(
          `/admin/system-config/api/studio/versions/${blueprintId}/unpublish/`,
          {},
          {
            headers: {
              'X-CSRFToken': csrfToken,
              'Content-Type': 'application/json',
            },
          }
        );
        setIsPublished(false);
        alert('✅ Workflow unpublished successfully!');
      } catch (error: any) {
        console.error('Error unpublishing:', error);
        alert(`❌ Failed to unpublish: ${error.message}`);
      } finally {
        setPublishing(false);
      }
    }
  };

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
              {blueprintName && <span className="font-medium">{blueprintName}</span>}
              {blueprintName && ' · '}
              Version: <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{blueprintId.slice(0, 8)}...</code>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!loading && (
              <>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    isPublished
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {isPublished ? '✅ Published' : '📝 Draft'}
                </span>
                {isPublished ? (
                  <button
                    onClick={handleUnpublish}
                    disabled={publishing}
                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {publishing ? '⏳ Unpublishing...' : '🔒 Unpublish'}
                  </button>
                ) : (
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {publishing ? '⏳ Publishing...' : '🚀 Publish Workflow'}
                  </button>
                )}
              </>
            )}
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
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📜 Version History
          </button>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {activeTab === 'schema' && (
          <SchemaEditor blueprintId={blueprintId} csrfToken={csrfToken || ''} />
        )}
        {activeTab === 'canvas' && (
          <UnifiedFlowEditor
            readOnly={false}
            editorMode="visual"
            onSave={(nodes, edges) => {
              console.log('Workflow saved:', { nodes, edges });
              // TODO: Integrate with backend persistence
            }}
          />
        )}
        {activeTab === 'history' && blueprintId && (
          <VersionHistory
            blueprintId={blueprintId}
            currentVersionId={blueprintId}
            onVersionSelect={(versionId) => {
              window.location.href = `/admin/system-config/studio/${versionId}/`;
            }}
            onRollback={(newVersionId) => {
              alert('Rolled back successfully! Redirecting to new version...');
              window.location.href = `/admin/system-config/studio/${newVersionId}/`;
            }}
          />
        )}
      </main>
    </div>
  );
};

export default Editor;
