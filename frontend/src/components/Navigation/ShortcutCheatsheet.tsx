/**
 * ShortcutCheatsheet — Modal overlay showing all keyboard shortcuts.
 *
 * Triggered by pressing "?" anywhere (outside input fields).
 * Groups shortcuts by category and renders styled kbd tags.
 */

import React, { useMemo } from 'react';
import { Modal, Typography, Space, Tag } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { SHORTCUT_REGISTRY, ShortcutDef } from '../../hooks/useGlobalShortcuts';

const { Text, Title } = Typography;

const CATEGORY_TITLES: Record<ShortcutDef['category'], string> = {
  general: 'General',
  navigation: 'Navigation (vim-style: press g then letter)',
  tools: 'Tools',
};

const CATEGORY_ORDER: ShortcutDef['category'][] = ['general', 'navigation', 'tools'];

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

const formatKeys = (keys: string): string => {
  if (isMac) return keys;
  return keys.replace('⌘', 'Ctrl+').replace('⇧', 'Shift+');
};

const KbdGroup: React.FC<{ keys: string }> = ({ keys }) => {
  const parts = formatKeys(keys).split(/\s+/);
  return (
    <Space size={4}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              then
            </Text>
          )}
          <Tag
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              padding: '1px 6px',
              background: 'rgb(var(--color-bg-secondary))',
              border: '1px solid rgb(var(--color-border))',
              borderRadius: 4,
              boxShadow: '0 1px 0 rgb(var(--color-border))',
            }}
          >
            {part}
          </Tag>
        </React.Fragment>
      ))}
    </Space>
  );
};

interface ShortcutCheatsheetProps {
  open: boolean;
  onClose: () => void;
}

export const ShortcutCheatsheet: React.FC<ShortcutCheatsheetProps> = ({
  open,
  onClose,
}) => {
  const grouped = useMemo(() => {
    const map: Record<string, ShortcutDef[]> = {};
    for (const s of SHORTCUT_REGISTRY) {
      (map[s.category] ??= []).push(s);
    }
    return map;
  }, []);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <Space>
          <KeyOutlined />
          Keyboard Shortcuts
        </Space>
      }
      width={480}
      centered
    >
      <div style={{ display: 'grid', gap: 16, padding: '8px 0' }}>
        {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => (
          <div key={cat}>
            <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
              {CATEGORY_TITLES[cat]}
            </Title>
            <div style={{ display: 'grid', gap: 6 }}>
              {grouped[cat].map((shortcut) => (
                <div
                  key={shortcut.keys}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                  }}
                >
                  <Text>{shortcut.label}</Text>
                  <KbdGroup keys={shortcut.keys} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <Text type="secondary" style={{ fontSize: 12 }}>
          Press <Tag style={{ fontSize: 11, padding: '0 4px' }}>?</Tag> anytime to show this help.
        </Text>
      </div>
    </Modal>
  );
};

export default ShortcutCheatsheet;
