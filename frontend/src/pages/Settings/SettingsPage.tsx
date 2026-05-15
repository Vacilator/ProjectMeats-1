/**
 * SettingsPage — Hub for all user/tenant settings.
 *
 * Tabs: Email Integrations | Notifications
 * URL drives the active tab via search-param (?tab=integrations|notifications).
 */
import React, { useMemo } from 'react';
import { Tabs } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { Mail, Bell } from 'lucide-react';
import styled from 'styled-components';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { IntegrationSettings } from './IntegrationSettings';
import NotificationPreferences from './NotificationPreferences';

type TabKey = 'integrations' | 'notifications';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'integrations', label: 'Email Integrations', icon: <Mail size={16} /> },
  { key: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
];

const SettingsPage: React.FC = () => {
  useDocumentTitle('Settings');
  const [params, setParams] = useSearchParams();
  const activeTab = (params.get('tab') as TabKey) || 'integrations';

  const items = useMemo(
    () =>
      TABS.map((t) => ({
        key: t.key,
        label: (
          <TabLabel>
            {t.icon}
            {t.label}
          </TabLabel>
        ),
        children: t.key === 'integrations' ? <IntegrationSettings /> : <NotificationPreferences />,
      })),
    [],
  );

  return (
    <Shell>
      <Header>Settings</Header>
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setParams({ tab: k }, { replace: true })}
        items={items}
        size="large"
      />
    </Shell>
  );
};

export default SettingsPage;

/* ── styled ────────────────────────────────────────────── */
const Shell = styled.div`
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 24px 48px;
`;

const Header = styled.h1`
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 16px;
`;

const TabLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;
