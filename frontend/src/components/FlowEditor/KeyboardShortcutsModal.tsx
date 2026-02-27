/**
 * Keyboard Shortcuts Help Modal
 * 
 * Displays all available keyboard shortcuts for the Flow Editor.
 * Helps users discover power-user features and improve productivity.
 * 
 * Features:
 * - Categorized shortcuts (Editing, Navigation, Selection, View)
 * - Platform-specific display (Ctrl vs Cmd)
 * - Search/filter shortcuts
 * - Quick reference card
 * - Export as PDF/image
 * 
 * Authority: Phase 7.6 - Accessibility & I18n
 */

import React, { useState, useMemo } from 'react';
import { Modal, Input, Typography, Tag, Space, Divider, Button, Tooltip } from 'antd';
import {
  SearchOutlined,
  CloseOutlined,
  DownloadOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';

const { Title, Text } = Typography;
const { Search } = Input;

interface Shortcut {
  keys: string[];
  description: string;
  category: 'Editing' | 'Navigation' | 'Selection' | 'View' | 'File';
}

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const StyledModal = styled(Modal)`
  .ant-modal-body {
    max-height: 70vh;
    overflow-y: auto;
    padding: 24px;
  }
`;

const ShortcutGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 16px;
`;

const ShortcutCard = styled.div`
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-border, 229, 229, 229));
  background: rgb(var(--color-bg-secondary, 250, 250, 250));
  transition: all 0.2s ease;

  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 2px 8px rgba(var(--color-primary), 0.1);
  }
`;

const KeyCombo = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;
`;

const KeyTag = styled(Tag)`
  font-family: 'Courier New', monospace;
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgb(var(--color-bg-primary, 255, 255, 255));
  border: 1px solid rgb(var(--color-border, 217, 217, 217));
  color: rgb(var(--color-text-primary, 0, 0, 0));
  font-weight: 600;
`;

const CategorySection = styled.div`
  margin-bottom: 24px;
`;

const CategoryTitle = styled(Title)`
  margin-bottom: 12px !important;
  color: rgb(var(--color-text-primary));
  font-size: 18px !important;
`;

// Detect operating system for platform-specific shortcuts
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const modKey = isMac ? '⌘' : 'Ctrl';
const altKey = isMac ? '⌥' : 'Alt';

// All available shortcuts
const ALL_SHORTCUTS: Shortcut[] = [
  // File operations
  { keys: [modKey, 'S'], description: 'Save workflow', category: 'File' },
  { keys: [modKey, 'O'], description: 'Open workflow', category: 'File' },
  { keys: [modKey, 'N'], description: 'New workflow', category: 'File' },
  { keys: [modKey, 'P'], description: 'Print/Export', category: 'File' },

  // Editing operations
  { keys: [modKey, 'Z'], description: 'Undo', category: 'Editing' },
  { keys: [modKey, 'Y'], description: 'Redo', category: 'Editing' },
  { keys: [modKey, 'Shift', 'Z'], description: 'Redo (alternate)', category: 'Editing' },
  { keys: [modKey, 'C'], description: 'Copy selected nodes', category: 'Editing' },
  { keys: [modKey, 'V'], description: 'Paste nodes', category: 'Editing' },
  { keys: [modKey, 'X'], description: 'Cut selected nodes', category: 'Editing' },
  { keys: [modKey, 'D'], description: 'Duplicate selected nodes', category: 'Editing' },
  { keys: ['Delete'], description: 'Delete selected items', category: 'Editing' },
  { keys: ['Backspace'], description: 'Delete selected items (alternate)', category: 'Editing' },

  // Selection operations
  { keys: [modKey, 'A'], description: 'Select all nodes', category: 'Selection' },
  { keys: ['Esc'], description: 'Deselect all', category: 'Selection' },
  { keys: ['Shift', 'Click'], description: 'Multi-select nodes', category: 'Selection' },
  { keys: [modKey, 'Click'], description: 'Add to selection', category: 'Selection' },

  // Navigation
  { keys: ['Space', 'Drag'], description: 'Pan canvas', category: 'Navigation' },
  { keys: ['Arrow Keys'], description: 'Move selected nodes', category: 'Navigation' },
  { keys: ['Shift', 'Arrow'], description: 'Move nodes faster (10px)', category: 'Navigation' },
  { keys: [modKey, 'F'], description: 'Search nodes', category: 'Navigation' },
  { keys: [modKey, 'G'], description: 'Find next', category: 'Navigation' },

  // View operations
  { keys: [modKey, '+'], description: 'Zoom in', category: 'View' },
  { keys: [modKey, '-'], description: 'Zoom out', category: 'View' },
  { keys: [modKey, '0'], description: 'Fit to view', category: 'View' },
  { keys: [modKey, '1'], description: 'Zoom to 100%', category: 'View' },
  { keys: [modKey, 'L'], description: 'Auto-layout', category: 'View' },
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'View' },
  { keys: ['F1'], description: 'Show help', category: 'View' },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  open,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter shortcuts based on search term
  const filteredShortcuts = useMemo(() => {
    if (!searchTerm) return ALL_SHORTCUTS;

    const term = searchTerm.toLowerCase();
    return ALL_SHORTCUTS.filter(
      (shortcut) =>
        shortcut.description.toLowerCase().includes(term) ||
        shortcut.keys.some((key) => key.toLowerCase().includes(term)) ||
        shortcut.category.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  // Group shortcuts by category
  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, Shortcut[]> = {};
    filteredShortcuts.forEach((shortcut) => {
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = [];
      }
      groups[shortcut.category].push(shortcut);
    });
    return groups;
  }, [filteredShortcuts]);

  const categories = ['File', 'Editing', 'Selection', 'Navigation', 'View'];

  const handleExport = () => {
    // Create a printable version
    const content = categories
      .map((category) => {
        const shortcuts = groupedShortcuts[category] || [];
        return `
## ${category}

${shortcuts
  .map((s) => `- **${s.keys.join(' + ')}**: ${s.description}`)
  .join('\n')}
`;
      })
      .join('\n\n');

    const blob = new Blob([`# Workflow Editor Keyboard Shortcuts\n\n${content}`], {
      type: 'text/markdown',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'keyboard-shortcuts.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <StyledModal
      title={
        <Space>
          <QuestionCircleOutlined />
          <Title level={4} style={{ margin: 0 }}>
            Keyboard Shortcuts
          </Title>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="export" icon={<DownloadOutlined />} onClick={handleExport}>
          Export
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          Got it!
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Platform indicator */}
        <div>
          <Text type="secondary">
            Shortcuts for: <Tag color="blue">{isMac ? 'macOS' : 'Windows/Linux'}</Tag>
          </Text>
        </div>

        {/* Search */}
        <Search
          placeholder="Search shortcuts..."
          prefix={<SearchOutlined />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          allowClear
          size="large"
        />

        {/* Results count */}
        {searchTerm && (
          <Text type="secondary">
            Found {filteredShortcuts.length} shortcut(s)
          </Text>
        )}

        {/* Shortcuts by category */}
        {categories.map((category) => {
          const shortcuts = groupedShortcuts[category];
          if (!shortcuts || shortcuts.length === 0) return null;

          return (
            <CategorySection key={category}>
              <CategoryTitle level={5}>{category}</CategoryTitle>
              <ShortcutGrid>
                {shortcuts.map((shortcut, index) => (
                  <ShortcutCard key={`${category}-${index}`}>
                    <KeyCombo>
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          <KeyTag>{key}</KeyTag>
                          {keyIndex < shortcut.keys.length - 1 && <Text>+</Text>}
                        </React.Fragment>
                      ))}
                    </KeyCombo>
                    <Text>{shortcut.description}</Text>
                  </ShortcutCard>
                ))}
              </ShortcutGrid>
            </CategorySection>
          );
        })}

        {filteredShortcuts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">No shortcuts found matching "{searchTerm}"</Text>
          </div>
        )}

        <Divider />

        {/* Tips */}
        <Space direction="vertical">
          <Title level={5}>💡 Pro Tips</Title>
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            <li>
              <Text>Hold <KeyTag>Shift</KeyTag> while dragging to move nodes faster</Text>
            </li>
            <li>
              <Text>
                Use <KeyTag>Space</KeyTag> + drag to pan the canvas quickly
              </Text>
            </li>
            <li>
              <Text>
                Press <KeyTag>?</KeyTag> anytime to open this shortcuts guide
              </Text>
            </li>
            <li>
              <Text>Most shortcuts work only when not typing in a text field</Text>
            </li>
          </ul>
        </Space>
      </Space>
    </StyledModal>
  );
};
