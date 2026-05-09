/**
 * Entity Node Component for React Flow
 * 
 * Custom node rendering with entity type icons and colors.
 * 
 * Theme Compliance:
 * - Uses CSS custom properties where possible
 * - Entity colors are semantic (defined by backend)
 */
import React, { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import styled from 'styled-components';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface EntityNodeData {
  [key: string]: unknown;
  label: string;
  entityType: string;
  entityId: number;
  icon: string;
  color: string;
  level: number;
  isRoot?: boolean;
}

// ============================================================================
// Styled Components
// ============================================================================

const NodeContainer = styled.div<{ $color: string; $isRoot: boolean }>`
  padding: 12px 16px;
  border-radius: var(--radius-lg);
  background: rgb(var(--color-surface));
  border: 2px solid ${props => props.$color};
  box-shadow: ${props => props.$isRoot 
    ? `0 4px 12px ${props.$color}40` 
    : '0 2px 8px rgba(0, 0, 0, 0.1)'};
  min-width: 140px;
  max-width: 200px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px ${props => props.$color}50;
  }
`;

const NodeHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
`;

const IconWrapper = styled.div<{ $color: string }>`
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  background: ${props => props.$color}20;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
`;

const NodeLabel = styled.div`
  font-weight: 600;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
`;

const NodeType = styled.div<{ $color: string }>`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${props => props.$color};
  font-weight: 500;
`;

const StyledHandle = styled(Handle)<{ $color: string }>`
  width: 8px;
  height: 8px;
  background: ${props => props.$color};
  border: 2px solid rgb(var(--color-surface));
`;

// ============================================================================
// Icon Mapping
// ============================================================================

const getIconEmoji = (iconName: string): string => {
  const icons: Record<string, string> = {
    Building2: '🏢',
    Users: '👥',
    ShoppingCart: '🛒',
    Receipt: '📄',
    Package: '📦',
    User: '👤',
    FileText: '📋',
    Factory: '🏭',
    Truck: '🚚',
    List: '📝',
    CreditCard: '💳',
    File: '📁',
  };
  return icons[iconName] || '📁';
};

// ============================================================================
// Component
// ============================================================================

export const EntityNode: React.FC<NodeProps<Node<EntityNodeData>>> = memo(({ data }) => {
  const { label, entityType, icon, color, isRoot = false } = data;

  return (
    <NodeContainer $color={color} $isRoot={isRoot}>
      <StyledHandle 
        type="target" 
        position={Position.Top} 
        $color={color}
      />
      
      <NodeHeader>
        <IconWrapper $color={color}>
          {getIconEmoji(icon)}
        </IconWrapper>
        <NodeLabel title={label}>{label}</NodeLabel>
      </NodeHeader>
      
      <NodeType $color={color}>
        {entityType.replace('_', ' ')}
      </NodeType>
      
      <StyledHandle 
        type="source" 
        position={Position.Bottom} 
        $color={color}
      />
    </NodeContainer>
  );
});

EntityNode.displayName = 'EntityNode';

export default EntityNode;
