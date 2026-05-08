/**
 * Help Modal Component
 *
 * Displays keyboard shortcuts, canvas commands, and workflow tips.
 *
 * Created: 2026-02-09 - Workform Editor Enhancements Batch 1
 */
import React from 'react';
import styled from 'styled-components';
import { X, Keyboard, Mouse, Zap, Info } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HelpItem {
  key: string;
  description: string;
}

interface HelpSection {
  title: string;
  icon: React.ReactNode;
  items: HelpItem[];
}

// ============================================================================
// Help Content
// ============================================================================

const helpSections: HelpSection[] = [
  {
    title: 'Keyboard Shortcuts',
    icon: <Keyboard size={20} />,
    items: [
      { key: 'Cmd/Ctrl + S', description: 'Save workflow' },
      { key: 'Cmd/Ctrl + Z', description: 'Undo last action' },
      { key: 'Cmd/Ctrl + Shift + Z', description: 'Redo last action' },
      { key: 'Delete / Backspace', description: 'Delete selected node(s)' },
      { key: 'Cmd/Ctrl + C', description: 'Copy selected node(s)' },
      { key: 'Cmd/Ctrl + V', description: 'Paste node(s)' },
      { key: 'Cmd/Ctrl + A', description: 'Select all nodes' },
      { key: 'Escape', description: 'Deselect all / Close modal' },
      { key: 'Space + Drag', description: 'Pan canvas' },
      { key: '+', description: 'Zoom in' },
      { key: '-', description: 'Zoom out' },
      { key: '0', description: 'Reset zoom to 100%' },
    ],
  },
  {
    title: 'Canvas Operations',
    icon: <Mouse size={20} />,
    items: [
      { key: 'Click + Drag', description: 'Select multiple nodes (marquee)' },
      { key: 'Shift + Click', description: 'Add node to selection' },
      { key: 'Drag from Output', description: 'Create connection' },
      { key: 'Click Connection', description: 'Select edge (for deletion)' },
      { key: 'Right Click Node', description: 'Open context menu' },
      { key: 'Double Click Node', description: 'Open configuration' },
      { key: 'Scroll', description: 'Zoom in/out' },
      { key: 'Middle Click + Drag', description: 'Pan canvas' },
    ],
  },
  {
    title: 'Node Operations',
    icon: <Zap size={20} />,
    items: [
      { key: 'Drag from Palette', description: 'Add new node to canvas' },
      { key: 'Edit Icon', description: 'Open node configuration' },
      { key: 'Delete Icon', description: 'Remove node from workflow' },
      { key: 'Collapse/Expand', description: 'Toggle node details view' },
      { key: 'Auto-Connect', description: 'Nodes auto-connect when dropped nearby' },
      { key: 'Smart Layout', description: 'Use layout buttons to organize nodes' },
    ],
  },
  {
    title: 'Workflow Tips',
    icon: <Info size={20} />,
    items: [
      { key: 'Start Simple', description: 'Begin with trigger → action → end' },
      { key: 'Test Often', description: 'Use preview mode to test workflows' },
      { key: 'Name Your Nodes', description: 'Edit titles for clarity' },
      { key: 'Use Containers', description: 'Multi-step containers for complex forms' },
      { key: 'Error Handling', description: 'Add error routes for robust workflows' },
      { key: 'Save Regularly', description: 'Auto-save may not catch everything' },
    ],
  },
];

// ============================================================================
// Styled Components
// ============================================================================

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(var(--color-overlay), 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  animation: fadeIn 0.2s ease;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const Modal = styled.div`
  background: rgb(var(--color-background));
  border-radius: var(--radius-lg, 8px);
  box-shadow: 0 25px 50px -12px rgba(var(--color-overlay), 0.25);
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 768px) {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const Title = styled.h2`
  font-size: 24px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const CloseButton = styled.button`
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgb(var(--color-text-secondary));
  border-radius: var(--radius-md, 6px);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgb(var(--color-surface-hover));
    color: rgb(var(--color-text-primary));
  }

  &:active {
    transform: scale(0.95);
  }
`;

const Content = styled.div`
  padding: 24px;
  overflow-y: auto;
  flex: 1;
`;

const SectionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 32px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 24px;
  }
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgb(var(--color-primary));
  font-size: 18px;
  font-weight: 600;
`;

const ItemsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Item = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const KeyBadge = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm, 4px);
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  color: rgb(var(--color-text-primary));
  min-width: 140px;
  text-align: center;
  white-space: nowrap;
  box-shadow: var(--shadow-sm);
`;

const Description = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  flex: 1;
`;

const Footer = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: rgb(var(--color-text-tertiary));
  font-size: 14px;
`;

// ============================================================================
// Component
// ============================================================================

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const handleOverlayClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  React.useEffect(() => {
    if (!isOpen) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, isOpen]);

  if (!isOpen) return null;

  return (
    <Overlay onClick={handleOverlayClick}>
      <Modal role="dialog" aria-labelledby="help-modal-title" aria-modal="true">
        <Header>
          <Title id="help-modal-title">WorkForms Editor Help</Title>
          <CloseButton
            onClick={onClose}
            aria-label="Close help modal"
            title="Close (Esc)"
          >
            <X size={20} />
          </CloseButton>
        </Header>

        <Content>
          <SectionsGrid>
            {helpSections.map((section, idx) => (
              <Section key={idx}>
                <SectionHeader>
                  {section.icon}
                  <span>{section.title}</span>
                </SectionHeader>
                <ItemsList>
                  {section.items.map((item, itemIdx) => (
                    <Item key={itemIdx}>
                      <KeyBadge>{item.key}</KeyBadge>
                      <Description>{item.description}</Description>
                    </Item>
                  ))}
                </ItemsList>
              </Section>
            ))}
          </SectionsGrid>
        </Content>

        <Footer>
          <Info size={16} />
          <span>Press <strong>?</strong> or click Help button to toggle this modal</span>
        </Footer>
      </Modal>
    </Overlay>
  );
};

export default HelpModal;
