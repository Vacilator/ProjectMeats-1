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

import React, { useState } from 'react';
import styled from 'styled-components';
import { Node, Edge } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Eye, Layers } from 'lucide-react';

import { DynamicConfigPanel } from './DynamicConfigPanel';

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

type TabId = 'general' | 'advanced' | 'preview';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

const TABS: Tab[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'advanced', label: 'Advanced', icon: Layers },
  { id: 'preview', label: 'Preview', icon: Eye },
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

  if (!node) return null;

  // Determine if preview tab should be visible (only for form nodes)
  const showPreview = node.type?.includes('form') || node.type?.includes('Form');

  const visibleTabs = showPreview ? TABS : TABS.filter(t => t.id !== 'preview');

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
                    // Show only basic sections in General tab
                    // Advanced sections go to Advanced tab
                    const basicSectionIds = ['basic', 'entity', 'fields', 'appearance', 'behavior'];
                    return basicSectionIds.includes(section.id);
                  }}
                />
              </TabPanel>
            )}

            {activeTab === 'logic' && isFormNode && (
              <TabPanel
                key="logic"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <VisualConditionalBuilder
                  fields={(node.data?.fields as FormField[]) || []}
                  rules={(node.data?.rules as FormRule[]) || []}
                  onChange={(newRules) => {
                    onUpdateNode(node.id, { rules: newRules });
                  }}
                />
              </TabPanel>
            )}

            {activeTab === 'logic' && isFormNode && (
              <TabPanel
                key="logic"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <VisualConditionalBuilder
                  fields={(node.data?.fields as FormField[]) || []}
                  rules={(node.data?.rules as FormRule[]) || []}
                  onChange={(newRules) => {
                    onUpdateNode(node.id, { rules: newRules });
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
                <DynamicConfigPanel
                  node={node}
                  nodes={nodes}
                  edges={edges}
                  onUpdateNode={onUpdateNode}
                  onApply={onApply}
                  onDiscard={onDiscard}
                  sectionFilter={(section) => {
                    // Show advanced sections: validation, conditional logic, integration, etc.
                    const advancedSectionIds = ['advanced', 'validation', 'conditional', 'integration', 'webhooks', 'email', 'notifications'];
                    return advancedSectionIds.includes(section.id);
                  }}
                />
                {/* Fallback JSON Editor if no advanced sections */}
                <AdvancedSection style={{ marginTop: '16px' }}>
                  <SectionTitle>Raw Configuration (JSON)</SectionTitle>
                  <InfoText>
                    Direct JSON editor for power users. Changes here override all other settings.
                  </InfoText>
                  <JSONEditor>
                    <pre>{JSON.stringify(node.data, null, 2)}</pre>
                  </JSONEditor>
                </AdvancedSection>
              </TabPanel>
            )}

            {activeTab === 'preview' && showPreview && (
              <TabPanel
                key="preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <PreviewSection>
                  <SectionTitle>Live Preview</SectionTitle>
                  <InfoText>
                    Preview how this form will appear to end users
                  </InfoText>
                  <PreviewFrame>
                    <PreviewPlaceholder>
                      📋 Form preview coming soon
                    </PreviewPlaceholder>
                  </PreviewFrame>
                </PreviewSection>
              </TabPanel>
            )}
          </AnimatePresence>
        </PanelContent>

        {/* Footer with Actions */}
        <PanelFooter>
          <FooterButton onClick={onDiscard} variant="secondary">
            Discard
          </FooterButton>
          <FooterButton onClick={onApply} variant="primary">
            Apply Changes
          </FooterButton>
        </PanelFooter>
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
  width: 480px;
  background: rgb(var(--color-background));
  border-left: 1px solid rgb(var(--color-border));
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 10000;
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
`;

const TabPanel = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  min-height: 100%;
  padding: 20px;
`;

const AdvancedSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PreviewSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SectionTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const InfoText = styled.p`
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
  line-height: 1.5;
`;

const JSONEditor = styled.div`
  background: rgb(var(--color-background-tertiary));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  padding: 16px;
  font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
  font-size: 12px;
  color: rgb(var(--color-text-primary));
  overflow: auto;
  max-height: 400px;

  pre {
    margin: 0;
  }
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
