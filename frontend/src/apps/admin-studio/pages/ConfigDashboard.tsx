import React, { useEffect, useState, useCallback } from 'react';
import dayjs from 'dayjs';
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
      logger.error('Error loading config data:', err);
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
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: 'rgb(var(--color-primary))' }} />
          <p className="mt-4" style={{ color: 'rgb(var(--color-text-secondary))' }}>Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-8" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
        <div className="max-w-4xl mx-auto">
          <div className="border rounded-lg p-6" style={{ background: 'rgb(var(--color-error-bg))', borderColor: 'rgb(var(--color-error))' }}>
            <h3 className="font-semibold" style={{ color: 'rgb(var(--color-error))' }}>Error Loading Configuration</h3>
            <p className="mt-2" style={{ color: 'rgb(var(--color-error))' }}>{error}</p>
            <button
              onClick={loadData}
              className="mt-4 px-4 py-2 text-[rgb(var(--color-text-inverse))] rounded hover:opacity-90 transition-colors"
              style={{ background: 'rgb(var(--color-error))' }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
      {/* Header */}
      <header className="shadow-sm border-b" style={{ background: 'rgb(var(--color-bg-primary))' }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>⚙️ Configuration Dashboard</h1>
              <p className="text-sm mt-1" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                Manage system and tenant configurations
              </p>
            </div>
            <button
              onClick={handleClearCache}
              className="px-4 py-2 text-sm rounded-lg hover:bg-[rgb(var(--color-bg-quaternary))] transition-colors flex items-center gap-2" style={{ background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-secondary))' }}
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-quaternary))] transition-colors text-sm" style={{ background: 'rgb(var(--color-bg-tertiary))', color: 'rgb(var(--color-text-secondary))' }}
          >
            📜 View Audit Log
          </Link>
        </div>

        {/* Tabs */}
        <div className="rounded-lg shadow-sm border" style={{ background: 'rgb(var(--color-bg-primary))' }}>
          <div className="border-b">
            <nav className="flex -mb-px">
              {(['overview', 'choices', 'configs', 'features'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-transparent'
                      : 'border-transparent hover:text-[rgb(var(--color-text-secondary))] hover:border-[rgb(var(--color-border-secondary))]'
                  }`}
                  style={{
                    borderColor: activeTab === tab ? 'rgb(var(--color-primary))' : undefined,
                    color: activeTab === tab ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-tertiary))',
                  }}
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
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[rgb(var(--color-primary))] focus:border-[rgb(var(--color-primary))]"
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
  const colorStyles: Record<string, React.CSSProperties> = {
    blue: { background: 'rgb(var(--color-info-bg))', color: 'rgb(var(--color-primary))', borderColor: 'rgb(var(--color-primary))' },
    green: { background: 'rgb(var(--color-success-bg))', color: 'rgb(var(--color-success))', borderColor: 'rgb(var(--color-success))' },
    purple: { background: 'rgb(var(--color-info-bg))', color: 'rgb(var(--color-primary))', borderColor: 'rgb(var(--color-primary))' },
    emerald: { background: 'rgb(var(--color-success-bg))', color: 'rgb(var(--color-success))', borderColor: 'rgb(var(--color-success))' },
  };

  return (
    <button
      onClick={onClick}
      className="border rounded-lg p-4 text-left transition-transform hover:scale-105 w-full"
      style={colorStyles[color]}
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
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'rgb(var(--color-text-primary))' }}>📋 Recent Choice Lists</h3>
        {recentChoiceLists.length > 0 ? (
          <ul className="space-y-2">
            {recentChoiceLists.map((list) => (
              <li
                key={list.id}
                className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgb(var(--color-bg-secondary))' }}
              >
                <div>
                  <span className="font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>{list.name}</span>
                  <span className="text-xs ml-2 font-mono" style={{ color: 'rgb(var(--color-text-tertiary))' }}>{list.slug}</span>
                </div>
                <span
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    background: list.is_extensible ? 'rgb(var(--color-warning-bg))' : 'rgb(var(--color-info-bg))',
                    color: list.is_extensible ? 'rgb(var(--color-warning))' : 'rgb(var(--color-primary))',
                  }}
                >
                  {list.is_extensible ? '🏢 Extensible' : '🔒 System'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'rgb(var(--color-text-tertiary))' }}>No choice lists found.</p>
        )}
      </div>

      {/* Config Categories */}
      <div>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'rgb(var(--color-text-primary))' }}>🔧 Config by Category</h3>
        {configsByCategory ? (
          <ul className="space-y-2">
            {Object.entries(configsByCategory).map(([category, configs]) => (
              <li
                key={category}
                className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgb(var(--color-bg-secondary))' }}
              >
                <span className="font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>{category}</span>
                <span className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>{configs.length} items</span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'rgb(var(--color-text-tertiary))' }}>No configurations found.</p>
        )}
      </div>

      {/* Enabled Features */}
      <div className="lg:col-span-2">
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'rgb(var(--color-text-primary))' }}>✅ Enabled Features</h3>
        {enabledFlags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {enabledFlags.map((flag) => (
              <span
                key={flag.key}
                className="px-3 py-1 rounded-full text-sm" style={{ background: 'rgb(var(--color-success-bg))', color: 'rgb(var(--color-success))' }}
              >
                {flag.key}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ color: 'rgb(var(--color-text-tertiary))' }}>No features currently enabled.</p>
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
    return <p className="text-center py-8" style={{ color: 'rgb(var(--color-text-tertiary))' }}>No choice lists found.</p>;
  }

  return (
    <div className="space-y-3">
      {choiceLists.map((list) => (
        <div key={list.id} className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleExpand(list.id)}
            className="w-full flex items-center justify-between p-4 hover:bg-[rgb(var(--color-bg-tertiary))] transition-colors" style={{ background: 'rgb(var(--color-bg-secondary))' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">📋</span>
              <div className="text-left">
                <span className="font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>{list.name}</span>
                <span className="text-xs ml-2 font-mono" style={{ color: 'rgb(var(--color-text-tertiary))' }}>{list.slug}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="text-xs px-2 py-1 rounded"
                style={{
                  background: list.is_extensible ? 'rgb(var(--color-warning-bg))' : 'rgb(var(--color-info-bg))',
                  color: list.is_extensible ? 'rgb(var(--color-warning))' : 'rgb(var(--color-primary))',
                }}
              >
                {list.is_extensible ? '🏢 Tenant Extensible' : '🔒 System Only'}
              </span>
              <span style={{ color: 'rgb(var(--color-text-quaternary))' }}>{expanded[list.id] ? '▲' : '▼'}</span>
            </div>
          </button>

          {expanded[list.id] && (
            <div className="p-4 border-t" style={{ background: 'rgb(var(--color-bg-primary))' }}>
              {list.description && (
                <p className="text-sm mb-4" style={{ color: 'rgb(var(--color-text-secondary))' }}>{list.description}</p>
              )}
              {list.items && list.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr style={{ background: 'rgb(var(--color-bg-tertiary))' }}>
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
                              className="text-xs px-2 py-0.5 rounded"
                              style={{
                                background: item.is_system ? 'rgb(var(--color-info-bg))' : 'rgb(var(--color-warning-bg))',
                                color: item.is_system ? 'rgb(var(--color-primary))' : 'rgb(var(--color-warning))',
                              }}
                            >
                              {item.is_system ? 'System' : 'Tenant'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className="text-xs"
                              style={{ color: item.is_active ? 'rgb(var(--color-success))' : 'rgb(var(--color-text-quaternary))' }}
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
                      className="inline-flex items-center gap-2 px-4 py-2 text-[rgb(var(--color-text-inverse))] rounded-lg hover:bg-[rgb(var(--color-primary-hover))] transition-colors text-sm" style={{ background: 'rgb(var(--color-primary))' }}
                    >
                      ✏️ Edit Items
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'rgb(var(--color-text-tertiary))' }}>No items in this list.</p>
              )}
            </div>
          )}
        </div>
      ))}
      
      {/* Open Editor Button */}
      <div className="mt-6 text-center">
        <Link
          to="/config/choices"
          className="inline-flex items-center gap-2 px-6 py-3 text-[rgb(var(--color-text-inverse))] rounded-lg hover:bg-[rgb(var(--color-primary-hover))] transition-colors font-medium" style={{ background: 'rgb(var(--color-primary))' }}
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
    return <p className="text-center py-8" style={{ color: 'rgb(var(--color-text-tertiary))' }}>No tenant configurations found.</p>;
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
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
            <span>{categoryIcons[category] || '📦'}</span>
            {category}
            <span className="text-sm font-normal" style={{ color: 'rgb(var(--color-text-tertiary))' }}>({configs.length})</span>
          </h3>
          <div className="rounded-lg overflow-hidden" style={{ background: 'rgb(var(--color-bg-secondary))' }}>
            <table className="min-w-full text-sm">
              <thead>
                <tr style={{ background: 'rgb(var(--color-bg-tertiary))' }}>
                  <th className="px-4 py-2 text-left font-medium" style={{ color: 'rgb(var(--color-text-secondary))' }}>Key</th>
                  <th className="px-4 py-2 text-left font-medium" style={{ color: 'rgb(var(--color-text-secondary))' }}>Value</th>
                  <th className="px-4 py-2 text-left font-medium" style={{ color: 'rgb(var(--color-text-secondary))' }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((config: TenantConfig) => (
                  <tr key={config.id} className="border-t" style={{ borderColor: 'rgb(var(--color-border-primary))' }}>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'rgb(var(--color-text-primary))' }}>{config.key}</td>
                    <td className="px-4 py-3">
                      <code className="px-2 py-1 rounded text-xs" style={{ background: 'rgb(var(--color-bg-quaternary))' }}>
                        {JSON.stringify(config.value).substring(0, 50)}
                        {JSON.stringify(config.value).length > 50 ? '...' : ''}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                      {dayjs(config.updated_at).format('MMM D, YYYY')}
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
          className="inline-flex items-center gap-2 px-6 py-3 text-[rgb(var(--color-text-inverse))] rounded-lg hover:bg-[rgb(var(--color-primary-hover))] transition-colors font-medium" style={{ background: 'rgb(var(--color-primary))' }}
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
    return <p className="text-center py-8" style={{ color: 'rgb(var(--color-text-tertiary))' }}>No feature flags found.</p>;
  }

  const enabledFlags = flags.filter((f) => f.enabled);
  const disabledFlags = flags.filter((f) => !f.enabled);

  return (
    <div className="space-y-6">
      {/* Enabled Flags */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
          ✅ Enabled
          <span className="text-sm font-normal" style={{ color: 'rgb(var(--color-text-tertiary))' }}>({enabledFlags.length})</span>
        </h3>
        {enabledFlags.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {enabledFlags.map((flag) => (
              <div
                key={flag.key}
                className="flex items-center gap-3 p-3 border rounded-lg" style={{ background: 'rgb(var(--color-success-bg))', borderColor: 'rgb(var(--color-success))' }}
              >
                <span className="w-3 h-3 rounded-full" style={{ background: 'rgb(var(--color-success))' }} />
                <span className="text-sm font-medium" style={{ color: 'rgb(var(--color-success))' }}>{flag.key}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'rgb(var(--color-text-tertiary))' }}>No enabled flags.</p>
        )}
      </div>

      {/* Disabled Flags */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
          ⭕ Disabled
          <span className="text-sm font-normal" style={{ color: 'rgb(var(--color-text-tertiary))' }}>({disabledFlags.length})</span>
        </h3>
        {disabledFlags.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {disabledFlags.map((flag) => (
              <div
                key={flag.key}
                className="flex items-center gap-3 p-3 border rounded-lg" style={{ background: 'rgb(var(--color-bg-secondary))', borderColor: 'rgb(var(--color-border-primary))' }}
              >
                <span className="w-3 h-3 rounded-full" style={{ background: 'rgb(var(--color-text-quaternary))' }} />
                <span className="text-sm font-medium" style={{ color: 'rgb(var(--color-text-secondary))' }}>{flag.key}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'rgb(var(--color-text-tertiary))' }}>No disabled flags.</p>
        )}
      </div>
    </div>
  );
};

export default ConfigDashboard;
