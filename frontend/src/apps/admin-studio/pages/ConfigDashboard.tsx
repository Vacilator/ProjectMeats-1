import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  configService,
  SystemChoiceList,
  TenantConfig,
  ConfigByCategory,
} from '../../../services/configService';
import { logger } from '@/utils/logger';

interface DashboardStats {
  choiceListCount: number;
  tenantConfigCount: number;
  featureFlagCount: number;
  enabledFeatures: number;
}

interface FeatureFlag {
  key: string;
  enabled: boolean;
}

export const ConfigDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [choiceLists, setChoiceLists] = useState<SystemChoiceList[]>([]);
  const [configsByCategory, setConfigsByCategory] = useState<ConfigByCategory | null>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'choices' | 'configs' | 'features'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [choiceListsData, configsData, flagsData] = await Promise.all([
        configService.getChoiceLists(),
        configService.getTenantConfigsByCategory(),
        configService.getFeatureFlags(),
      ]);

      setChoiceLists(choiceListsData);
      setConfigsByCategory(configsData);

      // Transform feature flags
      const flags: FeatureFlag[] = Object.entries(flagsData).map(([key, enabled]) => ({
        key,
        enabled: Boolean(enabled),
      }));
      setFeatureFlags(flags);

      // Calculate stats
      const totalConfigs = Object.values(configsData).flat().length;
      const enabledCount = flags.filter((f) => f.enabled).length;

      setStats({
        choiceListCount: choiceListsData.length,
        tenantConfigCount: totalConfigs,
        featureFlagCount: flags.length,
        enabledFeatures: enabledCount,
      });
    } catch (err) {
      logger.error('Error loading config data', { component: 'ConfigDashboard' }, err);
      setError('Failed to load configuration data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClearCache = () => {
    configService.clearCache();
    loadData();
  };

  const filteredChoiceLists = choiceLists.filter(
    (list) =>
      list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      list.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredConfigs = configsByCategory
    ? Object.entries(configsByCategory).reduce(
        (acc, [category, configs]) => {
          const filtered = configs.filter(
            (c: TenantConfig) =>
              c.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
              String(c.value).toLowerCase().includes(searchQuery.toLowerCase())
          );
          if (filtered.length > 0) {
            acc[category as keyof ConfigByCategory] = filtered;
          }
          return acc;
        },
        {} as Partial<ConfigByCategory>
      )
    : null;

  const filteredFlags = featureFlags.filter((f) =>
    f.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-red-800 font-semibold">Error Loading Configuration</h3>
            <p className="text-red-600 mt-2">{error}</p>
            <button
              onClick={loadData}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">⚙️ Configuration Dashboard</h1>
              <p className="text-gray-500 text-sm mt-1">
                Manage system and tenant configurations
              </p>
            </div>
            <button
              onClick={handleClearCache}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <span>🔄</span>
              Refresh Cache
            </button>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon="📋"
            label="Choice Lists"
            value={stats?.choiceListCount ?? 0}
            color="blue"
            onClick={() => setActiveTab('choices')}
          />
          <StatCard
            icon="🔧"
            label="Tenant Configs"
            value={stats?.tenantConfigCount ?? 0}
            color="green"
            onClick={() => setActiveTab('configs')}
          />
          <StatCard
            icon="🚩"
            label="Feature Flags"
            value={stats?.featureFlagCount ?? 0}
            color="purple"
            onClick={() => setActiveTab('features')}
          />
          <StatCard
            icon="✅"
            label="Enabled Features"
            value={stats?.enabledFeatures ?? 0}
            color="emerald"
            onClick={() => setActiveTab('features')}
          />
        </div>
        
        {/* Quick Actions Bar */}
        <div className="flex justify-end gap-3 mb-6">
          <Link
            to="/config/audit"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            📜 View Audit Log
          </Link>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="border-b">
            <nav className="flex -mb-px">
              {(['overview', 'choices', 'configs', 'features'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab === 'overview' && '📊 Overview'}
                  {tab === 'choices' && '📋 Choice Lists'}
                  {tab === 'configs' && '🔧 Tenant Configs'}
                  {tab === 'features' && '🚩 Feature Flags'}
                </button>
              ))}
            </nav>
          </div>

          {/* Search */}
          {activeTab !== 'overview' && (
            <div className="p-4 border-b">
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {/* Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <OverviewTab
                choiceLists={choiceLists}
                configsByCategory={configsByCategory}
                featureFlags={featureFlags}
              />
            )}

            {activeTab === 'choices' && (
              <ChoiceListsTab choiceLists={filteredChoiceLists} />
            )}

            {activeTab === 'configs' && (
              <TenantConfigsTab configsByCategory={filteredConfigs} />
            )}

            {activeTab === 'features' && (
              <FeatureFlagsTab flags={filteredFlags} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Sub-components
// =============================================================================

interface StatCardProps {
  icon: string;
  label: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'emerald';
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, onClick }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <button
      onClick={onClick}
      className={`${colorClasses[color]} border rounded-lg p-4 text-left transition-transform hover:scale-105 w-full`}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm opacity-80">{label}</div>
    </button>
  );
};

interface OverviewTabProps {
  choiceLists: SystemChoiceList[];
  configsByCategory: ConfigByCategory | null;
  featureFlags: FeatureFlag[];
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  choiceLists,
  configsByCategory,
  featureFlags,
}) => {
  const recentChoiceLists = choiceLists.slice(0, 5);
  const enabledFlags = featureFlags.filter((f) => f.enabled);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Recent Choice Lists */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Recent Choice Lists</h3>
        {recentChoiceLists.length > 0 ? (
          <ul className="space-y-2">
            {recentChoiceLists.map((list) => (
              <li
                key={list.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <span className="font-medium text-gray-900">{list.name}</span>
                  <span className="text-xs text-gray-500 ml-2 font-mono">{list.slug}</span>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    list.is_extensible
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {list.is_extensible ? '🏢 Extensible' : '🔒 System'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No choice lists found.</p>
        )}
      </div>

      {/* Config Categories */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🔧 Config by Category</h3>
        {configsByCategory ? (
          <ul className="space-y-2">
            {Object.entries(configsByCategory).map(([category, configs]) => (
              <li
                key={category}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span className="font-medium text-gray-900">{category}</span>
                <span className="text-sm text-gray-600">{configs.length} items</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No configurations found.</p>
        )}
      </div>

      {/* Enabled Features */}
      <div className="lg:col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">✅ Enabled Features</h3>
        {enabledFlags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {enabledFlags.map((flag) => (
              <span
                key={flag.key}
                className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
              >
                {flag.key}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No features currently enabled.</p>
        )}
      </div>
    </div>
  );
};

interface ChoiceListsTabProps {
  choiceLists: SystemChoiceList[];
}

const ChoiceListsTab: React.FC<ChoiceListsTabProps> = ({ choiceLists }) => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggleExpand = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (choiceLists.length === 0) {
    return <p className="text-gray-500 text-center py-8">No choice lists found.</p>;
  }

  return (
    <div className="space-y-3">
      {choiceLists.map((list) => (
        <div key={list.id} className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleExpand(list.id)}
            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">📋</span>
              <div className="text-left">
                <span className="font-semibold text-gray-900">{list.name}</span>
                <span className="text-xs text-gray-500 ml-2 font-mono">{list.slug}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-xs px-2 py-1 rounded ${
                  list.is_extensible
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {list.is_extensible ? '🏢 Tenant Extensible' : '🔒 System Only'}
              </span>
              <span className="text-gray-400">{expanded[list.id] ? '▲' : '▼'}</span>
            </div>
          </button>

          {expanded[list.id] && (
            <div className="p-4 border-t bg-white">
              {list.description && (
                <p className="text-sm text-gray-600 mb-4">{list.description}</p>
              )}
              {list.items && list.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-3 py-2 text-left">Value</th>
                        <th className="px-3 py-2 text-left">Label</th>
                        <th className="px-3 py-2 text-left">Scope</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.items.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-3 py-2 font-mono text-xs">{item.value}</td>
                          <td className="px-3 py-2">{item.label}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                item.is_system
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {item.is_system ? 'System' : 'Tenant'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`text-xs ${
                                item.is_active ? 'text-green-600' : 'text-gray-400'
                              }`}
                            >
                              {item.is_active ? '✓ Active' : '✗ Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-4 pt-4 border-t">
                    <Link
                      to={`/config/choices/${list.slug}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      ✏️ Edit Items
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No items in this list.</p>
              )}
            </div>
          )}
        </div>
      ))}
      
      {/* Open Editor Button */}
      <div className="mt-6 text-center">
        <Link
          to="/config/choices"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          📋 Open Choice List Editor
        </Link>
      </div>
    </div>
  );
};

interface TenantConfigsTabProps {
  configsByCategory: Partial<ConfigByCategory> | null;
}

const TenantConfigsTab: React.FC<TenantConfigsTabProps> = ({ configsByCategory }) => {
  if (!configsByCategory || Object.keys(configsByCategory).length === 0) {
    return <p className="text-gray-500 text-center py-8">No tenant configurations found.</p>;
  }

  const categoryIcons: Record<string, string> = {
    UI: '🎨',
    BUSINESS: '💼',
    FEATURES: '🚩',
    INTEGRATIONS: '🔗',
    OTHER: '📦',
  };

  return (
    <div className="space-y-6">
      {Object.entries(configsByCategory).map(([category, configs]) => (
        <div key={category}>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span>{categoryIcons[category] || '📦'}</span>
            {category}
            <span className="text-sm font-normal text-gray-500">({configs.length})</span>
          </h3>
          <div className="bg-gray-50 rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Key</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Value</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">Updated</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((config: TenantConfig) => (
                  <tr key={config.id} className="border-t border-gray-200">
                    <td className="px-4 py-3 font-mono text-xs text-gray-800">{config.key}</td>
                    <td className="px-4 py-3">
                      <code className="px-2 py-1 bg-gray-200 rounded text-xs">
                        {JSON.stringify(config.value).substring(0, 50)}
                        {JSON.stringify(config.value).length > 50 ? '...' : ''}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(config.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      
      {/* Open Editor Button */}
      <div className="mt-6 text-center">
        <Link
          to="/config/tenant"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          🔧 Open Tenant Config Editor
        </Link>
      </div>
    </div>
  );
};

interface FeatureFlagsTabProps {
  flags: FeatureFlag[];
}

const FeatureFlagsTab: React.FC<FeatureFlagsTabProps> = ({ flags }) => {
  if (flags.length === 0) {
    return <p className="text-gray-500 text-center py-8">No feature flags found.</p>;
  }

  const enabledFlags = flags.filter((f) => f.enabled);
  const disabledFlags = flags.filter((f) => !f.enabled);

  return (
    <div className="space-y-6">
      {/* Enabled Flags */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          ✅ Enabled
          <span className="text-sm font-normal text-gray-500">({enabledFlags.length})</span>
        </h3>
        {enabledFlags.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {enabledFlags.map((flag) => (
              <div
                key={flag.key}
                className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg"
              >
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-green-800">{flag.key}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No enabled flags.</p>
        )}
      </div>

      {/* Disabled Flags */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          ⭕ Disabled
          <span className="text-sm font-normal text-gray-500">({disabledFlags.length})</span>
        </h3>
        {disabledFlags.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {disabledFlags.map((flag) => (
              <div
                key={flag.key}
                className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"
              >
                <span className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-sm font-medium text-gray-600">{flag.key}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No disabled flags.</p>
        )}
      </div>
    </div>
  );
};

export default ConfigDashboard;
