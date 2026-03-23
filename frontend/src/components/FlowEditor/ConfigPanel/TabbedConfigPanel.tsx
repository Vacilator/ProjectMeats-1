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

import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Node, Edge } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Eye, Layers } from 'lucide-react';

import { DynamicConfigPanel } from './DynamicConfigPanel';
import { VisualFormBuilderPanel } from './VisualFormBuilderPanel';
import { LiveFormPreview } from './LiveFormPreview';
import DeveloperJsonEditor from './DeveloperJsonEditor';
import { FormField } from '../../form-builder/types';

// ============================================================================
// Types
// ============================================================================

export interface TabbedConfigPanelProps {
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
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
  onUpdateNode,
  onClose,
  onApply,
  onDiscard,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [developerMode, setDeveloperMode] = useState(() => {
    try {
      return window.localStorage.getItem('pm.floweditor.devMode') === 'true';
    } catch {
      return false;
    }
  });

  // Per MASTER_PLAN: raw JSON editing must not be part of the standard user flow.
  // We only show the UI toggle in dev builds; power users can still enable via localStorage.
  const showDevToolsToggle = import.meta.env.DEV;

  if (!node) return null;

  // Context-aware tab visibility
  const isContainerNode =
    node?.type === 'formBook' ||
    node?.type === 'formProcessGroup' ||
    node?.type === 'formMultiStepContainer' ||
    node?.type === 'formProcess';

  const isFormNode = node?.type === 'formStep' || node?.type === 'form' || node?.type === 'formStepSingle';

  const visibleTabs = useMemo(() => {
    return TABS.filter((tab) => {
      // Hide Fields/Preview for container nodes (steps managed on canvas; settings live in General/Advanced)
      if (tab.id === 'fields' || tab.id === 'preview') {
        return isFormNode && !isContainerNode;
      }

      return true;
    });
  }, [isContainerNode, isFormNode]);

  // If the previously selected tab is no longer visible for this node, fall back to General
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab('general');
    }
  }, [activeTab, visibleTabs]);

  return (
    <AnimatePresence>
      <PanelContainer
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
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </PanelHeader>

        {/* Tabs */}
        <TabsContainer>
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Tab
                key={tab.id}
                $active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <DynamicConfigPanel
                  node={node}
                  nodes={nodes}
                  edges={edges}
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <VisualFormBuilderPanel
                  fields={(node.data?.fields as FormField[]) || []}
                  onChange={(newFields) => {
                    onUpdateNode(node.id, { fields: newFields });
                  }}
                />
              </TabPanel>
            )}

            {activeTab === 'advanced' && (
              <TabPanel
                key="advanced"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {showDevToolsToggle && (
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

                {developerMode && (
                  <DeveloperJsonEditor
                    value={node.data}
                    onApply={(newData) => onUpdateNode(node.id, newData)}
                  />
                )}

                <DynamicConfigPanel
                  node={node}
                  nodes={nodes}
                  edges={edges}
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <LiveFormPreview
                  fields={(node.data?.fields as FormField[]) || []}
                  title={node.data?.label || node.data?.title || 'Form Preview'}
                  description={node.data?.description}
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
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
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

  svg {
    opacity: ${p => p.$active ? 1 : 0.6};
  }
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
  background: white;
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
    color: white;

    &:hover {
      background: rgb(var(--color-primary-dark));
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
