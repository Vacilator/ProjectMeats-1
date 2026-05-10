import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminClient } from '@/services/apiService';
import { showAlert } from '@/utils/uiDialogs';
import { logger } from '@/utils/logger';

interface Blueprint {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export const Dashboard: React.FC = () => {
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBlueprints();
  }, []);

  const fetchBlueprints = async () => {
    try {
      setLoading(true);
      // Using the available-workflows endpoint which lists published blueprints
      // For studio admin, we might want a different endpoint that lists ALL blueprints (drafts included)
      // But for now let's try available-workflows or check if there is a 'blueprints' endpoint
      const response = await adminClient.get('/admin/system-config/api/available-workflows/');
      setBlueprints(response.data);
      setError(null);
    } catch (err) {
      logger.error('Error fetching blueprints:', err);
      setError('Failed to load blueprints.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>Blueprint Studio</h1>
            <p className="mt-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>Manage system blueprints and workflows</p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/config"
              className="px-4 py-2 rounded-md hover:bg-[rgb(var(--color-bg-quaternary))] font-medium transition-colors flex items-center gap-2" style={{ background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-secondary))' }}
            >
              ⚙️ Config Dashboard
            </Link>
            <button 
              className="px-4 py-2 text-white rounded-md hover:bg-[rgb(var(--color-primary-hover))] font-medium transition-colors" style={{ background: 'rgb(var(--color-primary))' }}
              onClick={() => showAlert({ type: 'info', title: 'Coming soon', content: 'Create new blueprint functionality to be implemented' })}
            >
              + Create New Blueprint
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'rgb(var(--color-primary))' }} />
          </div>
        ) : error ? (
          <div className="border px-4 py-3 rounded" style={{ background: 'rgb(var(--color-error-bg))', borderColor: 'rgb(var(--color-error))', color: 'rgb(var(--color-error))' }}>
            {error}
          </div>
        ) : blueprints.length === 0 ? (
          <div className="rounded-lg shadow-sm p-12 text-center border" style={{ background: 'rgb(var(--color-bg-primary))', borderColor: 'rgb(var(--color-border-primary))' }}>
            <p className="text-lg" style={{ color: 'rgb(var(--color-text-tertiary))' }}>No blueprints found.</p>
            <p className="mt-2" style={{ color: 'rgb(var(--color-text-quaternary))' }}>Get started by creating your first blueprint.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blueprints.map((bp) => (
              <Link 
                key={bp.id} 
                to={`/${bp.id}`}
                className="block group"
              >
                <div className="rounded-lg shadow-sm border p-6 hover:shadow-md hover:border-[rgb(var(--color-primary))] transition-all cursor-pointer h-full" style={{ background: 'rgb(var(--color-bg-primary))', borderColor: 'rgb(var(--color-border-primary))' }}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 rounded-lg group-hover:bg-[rgb(var(--color-info-bg))] transition-colors" style={{ background: 'rgb(var(--color-info-bg))', color: 'rgb(var(--color-primary))' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-secondary))' }}>
                      {bp.slug}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2 group-hover:text-[rgb(var(--color-primary))] transition-colors" style={{ color: 'rgb(var(--color-text-primary))' }}>
                    {bp.name}
                  </h3>
                  <p className="text-sm" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                    Created: {new Date(bp.created_at).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
