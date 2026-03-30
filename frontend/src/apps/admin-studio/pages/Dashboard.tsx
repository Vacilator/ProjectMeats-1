import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminClient } from '@/services/apiService';
import { showAlert } from '@/utils/uiDialogs';

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
      console.error('Error fetching blueprints:', err);
      setError('Failed to load blueprints.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Blueprint Studio</h1>
            <p className="text-gray-500 mt-1">Manage system blueprints and workflows</p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/config"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium transition-colors flex items-center gap-2"
            >
              ⚙️ Config Dashboard
            </Link>
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors"
              onClick={() => showAlert({ type: 'info', title: 'Coming soon', content: 'Create new blueprint functionality to be implemented' })}
            >
              + Create New Blueprint
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : blueprints.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
            <p className="text-gray-500 text-lg">No blueprints found.</p>
            <p className="text-gray-400 mt-2">Get started by creating your first blueprint.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blueprints.map((bp) => (
              <Link 
                key={bp.id} 
                to={`/${bp.id}`}
                className="block group"
              >
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-100 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {bp.slug}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {bp.name}
                  </h3>
                  <p className="text-sm text-gray-500">
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
