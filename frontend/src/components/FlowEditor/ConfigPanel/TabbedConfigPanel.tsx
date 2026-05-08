/**
 * TabbedConfigPanel - Advanced Config Panel with Tabs
 *
 * Enhanced configuration panel with:
 * - Tabbed interface (General, Advanced, Preview)
 * - Schema-driven dynamic forms
 * - Live previews for form nodes
 * - Better UX with animations
 *
 * Created: 2026-02-24
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Node, Edge } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Eye, Layers } from 'lucide-react';

import { DynamicConfigPanel } from './DynamicConfigPanel';
import { VisualFormBuilderPanel } from './VisualFormBuilderPanel';
import { LiveFormPreview } from './LiveFormPreview';
import DeveloperJsonEditor from './DeveloperJsonEditor';
import { FormField } from '../../form-builder/types';
import { getResolvedFormFields } from '../utils/formFieldsDualModel';
import { IS_DEV_BUILD } from '@/utils/buildFlags';

// ============================================================================
// Types
// ============================================================================

export interface TabbedConfigPanelProps {
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  readOnly?: boolean;
  onUpdateNode: (nodeId: string, data: Partial<Node['data']>) => void;
  onClose: () => void;
  onApply?: () => void;
  onDiscard?: () => void;
}

type TabId = 'general' | 'fields' | 'advanced' | 'preview';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  showFor?: string[]; // Optional: only show for specific node types
}

const TABS: Tab[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'fields', label: 'Fields', icon: Layers, showFor: ['form', 'Form'] },
  { id: 'advanced', label: 'Advanced', icon: Layers },
  { id: 'preview', label: 'Preview', icon: Eye, showFor: ['form', 'Form'] },
];

// ============================================================================
// Component
// ============================================================================

export const TabbedConfigPanel: React.FC<TabbedConfigPanelProps> = ({
  node,
  nodes,
  edges,
  readOnly = false,
  onUpdateNode,
  onClose,
  onApply,
  onDiscard,
}) => {
  const tabsInstanceId = useId();

  const tabDomId = useCallback(
    (tabId: TabId) => `flow-config-tab-${tabsInstanceId}-${tabId}`,
    [tabsInstanceId]
  );

  const tabPanelDomId = useCallback(
    (tabId: TabId) => `flow-config-tabpanel-${tabsInstanceId}-${tabId}`,
    [tabsInstanceId]
  );

  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [focusedTab, setFocusedTab] = useState<TabId>('general');
  const tabButtonRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    general: null,
    fields: null,
    advanced: null,
    preview: null,
  });

  // Context-aware tab visibility (safe even when node is null)
  const nodeType = node?.type;
  const isContainerNode =
    nodeType === 'formBook' ||
    nodeType === 'formProcessGroup' ||
    nodeType === 'formMultiStepContainer' ||
    nodeType === 'formProcess';

  const isFormNode = nodeType === 'formStep' || nodeType === 'form' || nodeType === 'formStepSingle';

  const visibleTabs = useMemo(() => {
    return TABS.filter((tab) => {
      // Hide Fields/Preview for container nodes (steps managed on canvas; settings live in General/Advanced)
      if (tab.id === 'fields' || tab.id === 'preview') {
        return isFormNode && !isContainerNode;
      }

      return true;
    });
  }, [isContainerNode, isFormNode]);

  const visibleTabIds = useMemo(() => visibleTabs.map((t) => t.id), [visibleTabs]);

  useEffect(() => {
    if (!visibleTabIds.includes(activeTab)) {
      setActiveTab(visibleTabIds[0] ?? 'general');
    }
  }, [activeTab, visibleTabIds]);

  useEffect(() => {
    if (!visibleTabIds.includes(focusedTab)) {
      setFocusedTab(activeTab);
    }
  }, [activeTab, focusedTab, visibleTabIds]);

  const focusTab = useCallback((tabId: TabId) => {
    tabButtonRefs.current[tabId]?.focus();
    setFocusedTab(tabId);
  }, []);

  const activateTab = useCallback(
    (tabId: TabId) => {
      setActiveTab(tabId);
      focusTab(tabId);
    },
    [focusTab]
  );

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent, currentTabId: TabId) => {
      const idx = visibleTabIds.indexOf(currentTabId);
      if (idx < 0) return;

      const focusByIndex = (nextIndex: number) => {
        const nextId = visibleTabIds[nextIndex];
        if (!nextId) return;
        focusTab(nextId);
      };

      switch (e.key) {
        case 'ArrowLeft':
        case 'Left': {
          e.preventDefault();
          focusByIndex((idx - 1 + visibleTabIds.length) % visibleTabIds.length);
          break;
        }
        case 'ArrowRight':
        case 'Right': {
          e.preventDefault();
          focusByIndex((idx + 1) % visibleTabIds.length);
          break;
        }
        case 'Home': {
          e.preventDefault();
          focusByIndex(0);
          break;
        }
        case 'End': {
          e.preventDefault();
          focusByIndex(visibleTabIds.length - 1);
          break;
        }
        case 'Enter':
        case ' ':
        case 'Spacebar': {
          e.preventDefault();
          activateTab(currentTabId);
          break;
        }
        default:
          break;
      }
    },
    [activateTab, focusTab, visibleTabIds]
  );

  const [developerMode, setDeveloperMode] = useState(() => {
    if (!IS_DEV_BUILD) return false;
    try {
      return window.localStorage.getItem('pm.floweditor.devMode') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (IS_DEV_BUILD) return;

    setDeveloperMode(false);
    try {
      window.localStorage.removeItem('pm.floweditor.devMode');
    } catch {
      // ignore
    }
  }, []);

  // Per MASTER_PLAN: raw JSON editing must not ship to production.
  // This is intentionally build-time gated so it cannot be enabled via runtime config/localStorage in prod.
  const showDevToolsToggle = IS_DEV_BUILD;

  if (!node) return null;

  return (
    <AnimatePresence>
      <PanelContainer
        data-testid="flow-config-panel"
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <PanelHeader>
          <HeaderTitle>
            Configure Node
            <NodeTypeBadge>{node.type}</NodeTypeBadge>
          </HeaderTitle>
          <CloseButton
            onClick={onClose}
            aria-label="Close configuration panel"
            data-testid="flow-config-close"
          >
            <X size={20} />
          </CloseButton>
        </PanelHeader>

        {/* Tabs */}
        <TabsContainer
          role="tablist"
          aria-label="Node configuration"
          aria-orientation="horizontal"
          data-testid="flow-config-tablist"
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;

            return (
              <Tab
                key={tab.id}
                $active={isSelected}
                type="button"
                role="tab"
                id={tabDomId(tab.id)}
                aria-selected={isSelected}
                aria-controls={tabPanelDomId(tab.id)}
                tabIndex={focusedTab === tab.id ? 0 : -1}
                data-testid={`flow-config-tab-${tab.id}`}
                ref={(el) => {
                  tabButtonRefs.current[tab.id] = el;
                }}
                onFocus={() => setFocusedTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
                onClick={() => activateTab(tab.id)}
              >
                <IconWrapper aria-hidden="true">
                  <Icon size={16} />
                </IconWrapper>
                <TabLabel>{tab.label}</TabLabel>
              </Tab>
            );
          })}
        </TabsContainer>

        {/* Content */}
        <PanelContent>
          <AnimatePresence mode="wait">
            {activeTab === 'general' && (
              <TabPanel
                key="general"
                role="tabpanel"
                id={tabPanelDomId('general')}
                aria-labelledby={tabDomId('general')}
                data-testid="flow-config-tabpanel-general"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <DynamicConfigPanel
                  node={node}
                  nodes={nodes}
                  edges={edges}
                  readOnly={readOnly}
                  onUpdateNode={onUpdateNode}
                  onApply={onApply}
                  onDiscard={onDiscard}
                  sectionFilter={(section) => {
                    // Show everything by default in General, except sections intended for Advanced
                    const advancedSectionIds = [
                      'advanced',
                      'validation',
                      'conditional',
                      'integration',
                      'webhooks',
                      'email',
                      'notifications',
                      'errorHandling',
                      'http-auth',
                      'advanced-settings',
                    ].map((s) => s.toLowerCase());
                    const id = (section.id || '').toLowerCase();
                    return !advancedSectionIds.includes(id) && !id.includes('advanced');
                  }}
                />
              </TabPanel>
            )}

            {activeTab === 'fields' && isFormNode && !isContainerNode && (
              <TabPanel
                key="fields"
                role="tabpanel"
                id={tabPanelDomId('fields')}
                aria-labelledby={tabDomId('fields')}
                data-testid="flow-config-tabpanel-fields"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <VisualFormBuilderPanel
                  fields={getResolvedFormFields(node.data)}
                  readOnly={readOnly}
                  onChange={(newFields) => {
                    if (readOnly) return;
                    // Dual-model: persist form-builder fields separately from config-time entity picker selections.
                    onUpdateNode(node.id, { formFields: newFields });
                  }}
                />
              </TabPanel>
            )}

            {activeTab === 'advanced' && (
              <TabPanel
                key="advanced"
                role="tabpanel"
                id={tabPanelDomId('advanced')}
                aria-labelledby={tabDomId('advanced')}
                data-testid="flow-config-tabpanel-advanced"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {showDevToolsToggle && !readOnly && (
                  <DevToolsRow>
                    <DevToolsLabel>
                      <input
                        type="checkbox"
                        checked={developerMode}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setDeveloperMode(enabled);
                          try {
                            window.localStorage.setItem('pm.floweditor.devMode', String(enabled));
                          } catch {
                            // ignore
                          }
                        }}
                      />
                      Developer Mode
                    </DevToolsLabel>
                    <DevToolsHint>Shows a raw JSON escape hatch for node.data</DevToolsHint>
                  </DevToolsRow>
                )}

                {IS_DEV_BUILD && developerMode && !readOnly && (
                  <DeveloperJsonEditor
                    value={node.data}
                    onApply={(newData) => onUpdateNode(node.id, newData)}
                  />
                )}

                <DynamicConfigPanel
                  node={node}
                  nodes={nodes}
                  edges={edges}
                  readOnly={readOnly}
                  onUpdateNode={onUpdateNode}
                  onApply={onApply}
                  onDiscard={onDiscard}
                  sectionFilter={(section) => {
                    // Show only advanced sections here
                    const advancedSectionIds = [
                      'advanced',
                      'validation',
                      'conditional',
                      'integration',
                      'webhooks',
                      'email',
                      'notifications',
                      'errorHandling',
                      'http-auth',
                      'advanced-settings',
                    ].map((s) => s.toLowerCase());
                    const id = (section.id || '').toLowerCase();
                    return advancedSectionIds.includes(id) || id.includes('advanced');
                  }}
                />
              </TabPanel>
            )}

            {activeTab === 'preview' && isFormNode && !isContainerNode && (
              <TabPanel
                key="preview"
                role="tabpanel"
                id={tabPanelDomId('preview')}
                aria-labelledby={tabDomId('preview')}
                data-testid="flow-config-tabpanel-preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <LiveFormPreview
                  fields={getResolvedFormFields(node.data) as FormField[]}
                  title={String((node.data as any)?.label ?? (node.data as any)?.title ?? 'Form Preview')}
                  description={typeof (node.data as any)?.description === 'string' ? (node.data as any).description : undefined}
                />
              </TabPanel>
            )}
          </AnimatePresence>
        </PanelContent>

        {/*
          Apply/Discard controls are provided by the outer *WithShadow wrapper.
          Avoid duplicate "Apply" actions inside the panel.
        */}
      </PanelContainer>
    </AnimatePresence>
  );
};

// ============================================================================
// Styled Components
// ============================================================================

const PanelContainer = styled(motion.div)`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(480px, 100vw);
  max-width: 100vw;
  background: rgb(var(--color-background));
  border-left: 1px solid rgb(var(--color-border));
  box-shadow: -4px 0 24px rgba(var(--color-overlay), 0.1);
  display: flex;
  flex-direction: column;
  z-index: 10000;
  overflow: hidden;

  @media (max-width: 600px) {
    width: 100vw;
    border-left: none;
  }
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background-secondary));
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 12px;
`;

const NodeTypeBadge = styled.span`
  font-size: 12px;
  font-weight: 500;
  padding: 4px 8px;
  background: rgb(var(--color-primary) / 0.1);
  color: rgb(var(--color-primary));
  border-radius: 4px;
`;

const CloseButton = styled.button`
  padding: 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: rgb(var(--color-background-tertiary));
    color: rgb(var(--color-text-primary));
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: 2px;
  }
`;

const TabsContainer = styled.div`
  display: flex;
  padding: 0 20px;
  gap: 4px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background-secondary));
`;

const Tab = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: ${p => p.$active ? 'rgb(var(--color-background))' : 'transparent'};
  border: none;
  border-bottom: 2px solid ${p => p.$active ? 'rgb(var(--color-primary))' : 'transparent'};
  color: ${p => p.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-text-secondary))'};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: rgb(var(--color-primary));
    background: rgb(var(--color-background));
  }

  &:focus-visible {
    outline: 2px solid rgb(var(--color-primary));
    outline-offset: -2px;
  }

  svg {
    opacity: ${p => p.$active ? 1 : 0.6};
  }
`;

const IconWrapper = styled.span`
  display: inline-flex;
  align-items: center;
`;

const TabLabel = styled.span``;

const PanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  position: relative;
  /* Reserve space for the Apply/Discard bar rendered by TabbedConfigPanelWithShadow */
  padding-bottom: 92px;
`;

const TabPanel = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  min-height: 100%;
  padding: 20px;
`;

const PreviewSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PreviewFrame = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  padding: 24px;
  min-height: 300px;
`;

const PreviewPlaceholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
`;

const PanelFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background-secondary));
`;

const FooterButton = styled.button<{ variant: 'primary' | 'secondary' }>`
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  ${p => p.variant === 'primary' && `
    background: rgb(var(--color-primary));
    color: rgb(var(--color-primary-foreground));

    &:hover {
      background: rgb(var(--color-primary-hover));
    }
  `}

  ${p => p.variant === 'secondary' && `
    background: transparent;
    color: rgb(var(--color-text-secondary));
    border: 1px solid rgb(var(--color-border));

    &:hover {
      background: rgb(var(--color-background-tertiary));
      color: rgb(var(--color-text-primary));
    }
  `}
`;


const DevToolsRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  margin-bottom: 12px;
  background: rgba(var(--color-primary), 0.04);
`;

const DevToolsLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));

  input {
    width: 16px;
    height: 16px;
  }
`;

const DevToolsHint = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;
