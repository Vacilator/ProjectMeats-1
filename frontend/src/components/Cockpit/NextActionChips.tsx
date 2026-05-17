/**
 * NextActionChips — Contextual suggestion chips based on pending work items.
 *
 * Queries email stats and cockpit stats to surface the most important
 * next actions as dismissible floating chips below the hero search.
 * Each chip navigates to the relevant page when clicked.
 */

import React, { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Tag, Space } from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  MailOutlined,
  RobotOutlined,
  ShoppingCartOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';

// ─── Types ───────────────────────────────────────────────────────────
interface EmailStatsResponse {
  pending_review: number;
  auto_approved: number;
  total_drafts: number;
  avg_confidence: number;
}

interface CockpitStatsResponse {
  todays_numbers?: {
    pending_orders?: number;
    orders_today?: number;
    completed_today?: number;
  };
}

interface ActionChip {
  key: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  route: string;
  priority: number;
}

// ─── Component ───────────────────────────────────────────────────────
export const NextActionChips: React.FC = () => {
  const navigate = useNavigate();

  const emailStatsQuery = useQuery({
    queryKey: withTenantQueryKey('next-action-email-stats'),
    queryFn: async () => {
      const res = await businessApi.get<EmailStatsResponse>('/integrations/email/stats/');
      return res.data;
    },
    staleTime: 30_000,
    retry: false,
  });

  const cockpitStatsQuery = useQuery({
    queryKey: withTenantQueryKey('next-action-cockpit-stats'),
    queryFn: async () => {
      const res = await businessApi.get<CockpitStatsResponse>('cockpit/stats/');
      return res.data;
    },
    staleTime: 30_000,
    retry: false,
  });

  const chips = useMemo<ActionChip[]>(() => {
    const items: ActionChip[] = [];
    const email = emailStatsQuery.data;
    const cockpit = cockpitStatsQuery.data;

    if (email?.pending_review && email.pending_review > 0) {
      items.push({
        key: 'review-drafts',
        icon: <MailOutlined />,
        label: `Review ${email.pending_review} email draft${email.pending_review === 1 ? '' : 's'}`,
        color: 'orange',
        route: '/command-center?tab=action-required',
        priority: 1,
      });
    }

    if (cockpit?.todays_numbers?.pending_orders && cockpit.todays_numbers.pending_orders > 0) {
      items.push({
        key: 'pending-orders',
        icon: <ShoppingCartOutlined />,
        label: `${cockpit.todays_numbers.pending_orders} pending order${cockpit.todays_numbers.pending_orders === 1 ? '' : 's'}`,
        color: 'blue',
        route: '/purchase-orders',
        priority: 2,
      });
    }

    if (email?.auto_approved && email.auto_approved > 0) {
      items.push({
        key: 'auto-processed',
        icon: <RobotOutlined />,
        label: `${email.auto_approved} auto-processed`,
        color: 'green',
        route: '/command-center?tab=action-required',
        priority: 4,
      });
    }

    if (cockpit?.todays_numbers?.completed_today && cockpit.todays_numbers.completed_today > 0) {
      items.push({
        key: 'completed-today',
        icon: <CheckCircleOutlined />,
        label: `${cockpit.todays_numbers.completed_today} completed today`,
        color: 'success',
        route: '/sales-orders',
        priority: 5,
      });
    }

    if (
      email?.avg_confidence !== undefined &&
      email.avg_confidence > 0 &&
      email.avg_confidence < 0.7 &&
      (email.total_drafts ?? 0) > 5
    ) {
      items.push({
        key: 'low-confidence',
        icon: <ExclamationCircleOutlined />,
        label: `Low avg confidence (${(email.avg_confidence * 100).toFixed(0)}%)`,
        color: 'red',
        route: '/command-center?tab=action-required',
        priority: 0,
      });
    }

    return items.sort((a, b) => a.priority - b.priority);
  }, [emailStatsQuery.data, cockpitStatsQuery.data]);

  const handleClick = useCallback(
    (route: string) => {
      navigate(route);
    },
    [navigate],
  );

  if (chips.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '0 24px',
      }}
    >
      <Space size={[8, 6]} wrap style={{ justifyContent: 'center' }}>
        <ThunderboltOutlined
          style={{ color: 'rgb(var(--color-text-tertiary))', fontSize: 12 }}
        />
        {chips.map((chip) => (
          <Tag
            key={chip.key}
            icon={chip.icon}
            color={chip.color}
            style={{ cursor: 'pointer', fontSize: 12 }}
            onClick={() => handleClick(chip.route)}
          >
            {chip.label}
          </Tag>
        ))}
      </Space>
    </div>
  );
};

export default NextActionChips;
