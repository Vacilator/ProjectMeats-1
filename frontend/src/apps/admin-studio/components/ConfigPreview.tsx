/**
 * ConfigPreview Component
 * 
 * Wave 4 Task 4.9: Real-time preview of configuration changes.
 * 
 * Shows a live preview of how configuration changes will affect:
 * - UI theme (colors, typography)
 * - Feature flags (enabled/disabled features)
 * - Business rules (limits, thresholds)
 * - Form field configurations
 * 
 * Features:
 * - Split-pane view (editor + preview)
 * - Live updates as config values change
 * - Mock components to demonstrate effects
 * - Theme preview panel
 */
import React, { useMemo } from 'react';
import { ConfigCategory } from '../../../services/configService';

interface ConfigPreviewProps {
  /** Current config values being edited */
  configs: Array<{
    key: string;
    value: unknown;
    category: ConfigCategory;
  }>;
  /** Currently selected category */
  selectedCategory: ConfigCategory;
}

// Sample data for preview
const SAMPLE_ENTITIES = {
  supplier: { name: 'Tyson Foods', location: 'Chicago, IL', status: 'Active' },
  customer: { name: 'Costco #405', location: 'Los Angeles, CA', status: 'Premium' },
  order: { number: 'PO-2026-0142', amount: 45230, date: '2026-02-03' },
};

export const ConfigPreview: React.FC<ConfigPreviewProps> = ({
  configs,
  selectedCategory,
}) => {
  // Extract current config values
  const configMap = useMemo(() => {
    const map: Record<string, unknown> = {};
    configs.forEach(c => { map[c.key] = c.value; });
    return map;
  }, [configs]);
  
  // Get config value with default
  const getConfig = <T,>(key: string, defaultValue: T): T => {
    return (configMap[key] as T) ?? defaultValue;
  };
  
  // UI Theme Preview
  const ThemePreview: React.FC = () => {
    const primaryColor = getConfig<string>('ui.theme.primary_color', '#667eea');
    const secondaryColor = getConfig<string>('ui.theme.secondary_color', '#764ba2');
    const borderRadius = getConfig<number>('ui.theme.border_radius', 8);
    const fontFamily = getConfig<string>('ui.theme.font_family', 'Inter');
    const darkMode = getConfig<boolean>('ui.theme.dark_mode', false);
    
    const bgColor = darkMode ? '#1a1a2e' : '#ffffff';
    const textColor = darkMode ? '#e0e0e0' : '#1a1a2e';
    const cardBg = darkMode ? '#2a2a3e' : '#f9fafb';
    
    return (
      <div 
        className="p-4 border rounded-lg transition-all"
        style={{ 
          backgroundColor: bgColor, 
          color: textColor,
          fontFamily,
          borderRadius: `${borderRadius}px`,
        }}
      >
        <h4 className="text-sm font-semibold mb-3">🎨 Theme Preview</h4>
        
        {/* Sample Card */}
        <div 
          className="p-3 mb-3"
          style={{ 
            backgroundColor: cardBg, 
            borderRadius: `${borderRadius}px`,
            border: `1px solid ${darkMode ? '#3a3a4e' : '#e5e7eb'}`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs"
              style={{ backgroundColor: primaryColor }}
            >
              TF
            </div>
            <div>
              <div className="font-medium text-sm">{SAMPLE_ENTITIES.supplier.name}</div>
              <div className="text-xs opacity-70">{SAMPLE_ENTITIES.supplier.location}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <span 
              className="text-xs px-2 py-1 text-white"
              style={{ backgroundColor: primaryColor, borderRadius: `${borderRadius / 2}px` }}
            >
              {SAMPLE_ENTITIES.supplier.status}
            </span>
          </div>
        </div>
        
        {/* Sample Buttons */}
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 text-xs text-white font-medium transition-colors"
            style={{ 
              backgroundColor: primaryColor, 
              borderRadius: `${borderRadius}px`,
            }}
          >
            Primary
          </button>
          <button
            className="px-3 py-1.5 text-xs text-white font-medium"
            style={{ 
              backgroundColor: secondaryColor, 
              borderRadius: `${borderRadius}px`,
            }}
          >
            Secondary
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium border"
            style={{ 
              borderRadius: `${borderRadius}px`,
              borderColor: primaryColor,
              color: primaryColor,
              backgroundColor: 'transparent',
            }}
          >
            Outline
          </button>
        </div>
        
        {/* Color Swatches */}
        <div className="flex gap-2 mt-3">
          <div 
            className="w-8 h-8 rounded border"
            style={{ backgroundColor: primaryColor }}
            title={`Primary: ${primaryColor}`}
          />
          <div 
            className="w-8 h-8 rounded border"
            style={{ backgroundColor: secondaryColor }}
            title={`Secondary: ${secondaryColor}`}
          />
          <div 
            className="w-8 h-8 rounded border flex items-center justify-center text-xs"
            style={{ backgroundColor: bgColor, color: textColor }}
          >
            Bg
          </div>
        </div>
      </div>
    );
  };
  
  // Feature Flags Preview
  const FeaturesPreview: React.FC = () => {
    const aiAssistant = getConfig<boolean>('features.ai_assistant.enabled', true);
    const bulkOperations = getConfig<boolean>('features.bulk_operations.enabled', true);
    const advancedReports = getConfig<boolean>('features.advanced_reports.enabled', false);
    const realTimeUpdates = getConfig<boolean>('features.realtime_updates.enabled', false);
    const mobileApp = getConfig<boolean>('features.mobile_app.enabled', false);
    
    const features = [
      { key: 'AI Assistant', enabled: aiAssistant, icon: '🤖' },
      { key: 'Bulk Operations', enabled: bulkOperations, icon: '📦' },
      { key: 'Advanced Reports', enabled: advancedReports, icon: '📊' },
      { key: 'Real-time Updates', enabled: realTimeUpdates, icon: '⚡' },
      { key: 'Mobile App', enabled: mobileApp, icon: '📱' },
    ];
    
    return (
      <div className="p-4 border rounded-lg bg-white">
        <h4 className="text-sm font-semibold mb-3 text-gray-900">🚩 Feature Flags</h4>
        <div className="space-y-2">
          {features.map(f => (
            <div 
              key={f.key}
              className={`flex items-center justify-between p-2 rounded transition-colors ${
                f.enabled ? 'bg-green-50' : 'bg-gray-50'
              }`}
            >
              <span className="text-sm flex items-center gap-2">
                <span>{f.icon}</span>
                <span className={f.enabled ? 'text-gray-900' : 'text-gray-500'}>
                  {f.key}
                </span>
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                f.enabled 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {f.enabled ? 'ON' : 'OFF'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Business Rules Preview
  const BusinessRulesPreview: React.FC = () => {
    const autoApproveThreshold = getConfig<number>('business.po.auto_approve_threshold', 5000);
    const maxLineItems = getConfig<number>('business.po.max_line_items', 50);
    const defaultPaymentTerms = getConfig<string>('business.invoice.default_payment_terms', 'Net 30');
    const currencySymbol = getConfig<string>('business.locale.currency_symbol', '$');
    const dateFormat = getConfig<string>('business.locale.date_format', 'MM/DD/YYYY');
    
    return (
      <div className="p-4 border rounded-lg bg-white">
        <h4 className="text-sm font-semibold mb-3 text-gray-900">💼 Business Rules</h4>
        
        {/* Auto-Approval Demo */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Auto-Approval Threshold</div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-green-600">
              {currencySymbol}{autoApproveThreshold.toLocaleString()}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            POs under this amount are auto-approved
          </div>
        </div>
        
        {/* Sample Order */}
        <div className="p-3 bg-blue-50 rounded-lg mb-3">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium text-sm">{SAMPLE_ENTITIES.order.number}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              SAMPLE_ENTITIES.order.amount < autoApproveThreshold 
                ? 'bg-green-100 text-green-800' 
                : 'bg-amber-100 text-amber-800'
            }`}>
              {SAMPLE_ENTITIES.order.amount < autoApproveThreshold 
                ? '✓ Auto-Approved' 
                : '⏳ Needs Approval'}
            </span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {currencySymbol}{SAMPLE_ENTITIES.order.amount.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {dateFormat.replace('MM', '02').replace('DD', '03').replace('YYYY', '2026')}
          </div>
        </div>
        
        {/* Other Rules */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 bg-gray-50 rounded">
            <div className="text-xs text-gray-500">Max Line Items</div>
            <div className="font-medium">{maxLineItems}</div>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <div className="text-xs text-gray-500">Payment Terms</div>
            <div className="font-medium">{defaultPaymentTerms}</div>
          </div>
        </div>
      </div>
    );
  };
  
  // Integrations Preview
  const IntegrationsPreview: React.FC = () => {
    const emailProvider = getConfig<string>('integrations.email.provider', 'sendgrid');
    const emailEnabled = getConfig<boolean>('integrations.email.enabled', false);
    const slackEnabled = getConfig<boolean>('integrations.slack.enabled', false);
    const stripeEnabled = getConfig<boolean>('integrations.stripe.enabled', false);
    const quickbooksEnabled = getConfig<boolean>('integrations.quickbooks.enabled', false);
    
    const integrations = [
      { name: 'Email', provider: emailProvider, enabled: emailEnabled, icon: '📧' },
      { name: 'Slack', provider: 'slack', enabled: slackEnabled, icon: '💬' },
      { name: 'Stripe', provider: 'stripe', enabled: stripeEnabled, icon: '💳' },
      { name: 'QuickBooks', provider: 'quickbooks', enabled: quickbooksEnabled, icon: '📒' },
    ];
    
    return (
      <div className="p-4 border rounded-lg bg-white">
        <h4 className="text-sm font-semibold mb-3 text-gray-900">🔗 Integrations</h4>
        <div className="space-y-2">
          {integrations.map(i => (
            <div 
              key={i.name}
              className={`flex items-center justify-between p-2 rounded border transition-all ${
                i.enabled 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-lg">{i.icon}</span>
                <div>
                  <div className={`text-sm font-medium ${i.enabled ? 'text-gray-900' : 'text-gray-500'}`}>
                    {i.name}
                  </div>
                  <div className="text-xs text-gray-400 capitalize">{i.provider}</div>
                </div>
              </span>
              <div className={`w-3 h-3 rounded-full ${
                i.enabled ? 'bg-green-500' : 'bg-gray-300'
              }`} />
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Other/Generic Preview
  const OtherPreview: React.FC = () => {
    return (
      <div className="p-4 border rounded-lg bg-white">
        <h4 className="text-sm font-semibold mb-3 text-gray-900">📦 Other Configurations</h4>
        <div className="space-y-2">
          {configs.filter(c => c.category === 'OTHER').slice(0, 5).map(c => (
            <div key={c.key} className="flex justify-between items-center p-2 bg-gray-50 rounded">
              <span className="text-sm font-mono text-gray-700">{c.key}</span>
              <span className="text-sm text-gray-500 truncate max-w-[150px]">
                {typeof c.value === 'object' ? JSON.stringify(c.value) : String(c.value)}
              </span>
            </div>
          ))}
          {configs.filter(c => c.category === 'OTHER').length === 0 && (
            <div className="text-center py-6 text-gray-400">
              <div className="text-3xl mb-2">📦</div>
              <p className="text-sm">No configs in this category</p>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Render preview based on selected category
  const renderPreview = () => {
    switch (selectedCategory) {
      case 'UI':
        return <ThemePreview />;
      case 'FEATURES':
        return <FeaturesPreview />;
      case 'BUSINESS':
        return <BusinessRulesPreview />;
      case 'INTEGRATIONS':
        return <IntegrationsPreview />;
      case 'OTHER':
      default:
        return <OtherPreview />;
    }
  };
  
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            👁️ Live Preview
          </h3>
          <span className="text-xs text-gray-400">
            Changes preview in real-time
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
        {renderPreview()}
      </div>
      <div className="p-2 border-t bg-gray-50 text-xs text-gray-400 text-center">
        Preview updates automatically as you edit configs
      </div>
    </div>
  );
};

export default ConfigPreview;
