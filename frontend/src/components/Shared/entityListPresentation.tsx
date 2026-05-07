import React from 'react';
import styled from 'styled-components';
import { Building2, Clock, FileText, Package, Users } from 'lucide-react';

export type EntityListItem = {
  id: string | number;
  type: string;
  name: string;
  subtitle?: string;
  tooltip?: string;
};

export const getEntityIcon = (rawType: string, size = 20) => {
  const type = String(rawType || '').toLowerCase();

  switch (type) {
    case 'customer':
      return <Users size={size} />;
    case 'supplier':
      return <Building2 size={size} />;
    case 'plant':
    case 'location':
      return <Building2 size={size} />;
    case 'contact':
      return <Users size={size} />;
    case 'product':
      return <Package size={size} />;
    case 'purchase_order':
    case 'sales_order':
    case 'invoice':
    case 'inquiry':
    case 'claim':
      return <FileText size={size} />;
    case 'call':
      return <Clock size={size} />;
    case 'tenant_user':
      return <Users size={size} />;
    default:
      return <FileText size={size} />;
  }
};

export const getEntityTone = (rawType: string) => {
  // Return an RGB tuple CSS var so we can safely use rgb()/rgba() wrappers.
  const type = String(rawType || '').toLowerCase();

  switch (type) {
    case 'customer':
      return 'var(--color-success)';
    case 'supplier':
      return 'var(--color-primary)';
    case 'plant':
    case 'location':
      return 'var(--color-primary)';
    case 'contact':
      return 'var(--color-info)';
    case 'product':
      return 'var(--color-warning)';
    case 'purchase_order':
    case 'sales_order':
    case 'invoice':
      return 'var(--color-warning)';
    case 'inquiry':
    case 'claim':
      return 'var(--color-error)';
    case 'call':
      return 'var(--color-info)';
    case 'tenant_user':
      return 'var(--color-primary)';
    default:
      return 'var(--color-primary)';
  }
};

const Cell = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const Icon = styled.div<{ $tone: string }>`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;

  background: ${(p) => `rgba(${p.$tone}, 0.12)`};
  color: ${(p) => `rgb(${p.$tone})`};
`;

const TextBlock = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

const Title = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Subtitle = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const EntityListPrimaryCell: React.FC<{ item: EntityListItem }> = ({ item }) => {
  const tone = getEntityTone(item.type);
  const title = item.tooltip || item.name;

  return (
    <Cell>
      <Icon $tone={tone}>{getEntityIcon(item.type, 16)}</Icon>
      <TextBlock>
        <Title title={title}>{item.name}</Title>
        {item.subtitle ? <Subtitle title={item.subtitle}>{item.subtitle}</Subtitle> : null}
      </TextBlock>
    </Cell>
  );
};
