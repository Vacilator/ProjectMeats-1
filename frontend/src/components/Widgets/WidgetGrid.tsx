/**
 * Widget Grid Component
 * 
 * Draggable, resizable grid layout for dashboard widgets.
 * Uses react-grid-layout for drag-and-drop functionality.
 * 
 * Features:
 * - Drag and drop widget positioning
 * - Resizable widgets
 * - Responsive breakpoints
 * - Layout persistence
 * 
 * Theme Compliance:
 * - Uses CSS custom properties
 */
import React, { useState, useCallback, useEffect } from 'react';
import GridLayout, { Layout } from 'react-grid-layout';
import styled from 'styled-components';
import 'react-grid-layout/css/styles.css';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  props?: Record<string, any>;
}

export interface WidgetLayout extends Layout {
  i: string;
}

export interface WidgetGridProps {
  widgets: WidgetConfig[];
  layout: WidgetLayout[];
  onLayoutChange: (layout: WidgetLayout[]) => void;
  renderWidget: (widget: WidgetConfig) => React.ReactNode;
  cols?: number;
  rowHeight?: number;
  width?: number;
  className?: string;
  isEditing?: boolean;
}

// ============================================================================
// Styled Components
// ============================================================================

const GridContainer = styled.div<{ $isEditing: boolean }>`
  .react-grid-item {
    transition: all 200ms ease;
    transition-property: left, top;
    
    &.react-grid-item.cssTransforms {
      transition-property: transform;
    }

    &.react-grid-placeholder {
      background: rgb(var(--color-primary) / 0.2);
      border: 2px dashed rgb(var(--color-primary));
      border-radius: var(--radius-lg);
      opacity: 0.5;
    }

    &.resizing {
      z-index: 100;
      opacity: 0.9;
    }

    &.react-draggable-dragging {
      z-index: 100;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    }

    /* Show resize handle only in edit mode */
    .react-resizable-handle {
      display: ${props => props.$isEditing ? 'block' : 'none'};
      position: absolute;
      width: 20px;
      height: 20px;
      bottom: 0;
      right: 0;
      cursor: se-resize;
      
      &::after {
        content: '';
        position: absolute;
        right: 4px;
        bottom: 4px;
        width: 8px;
        height: 8px;
        border-right: 2px solid rgb(var(--color-border));
        border-bottom: 2px solid rgb(var(--color-border));
      }
    }
  }
`;

const WidgetWrapper = styled.div<{ $isEditing: boolean }>`
  height: 100%;
  border-radius: var(--radius-lg);
  overflow: hidden;
  
  ${props => props.$isEditing && `
    cursor: move;
    
    &:hover {
      box-shadow: 0 0 0 2px rgb(var(--color-primary) / 0.3);
    }
  `}
`;

// ============================================================================
// Component
// ============================================================================

export const WidgetGrid: React.FC<WidgetGridProps> = ({
  widgets,
  layout,
  onLayoutChange,
  renderWidget,
  cols = 12,
  rowHeight = 100,
  width = 1200,
  className,
  isEditing = false,
}) => {
  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      onLayoutChange(newLayout as WidgetLayout[]);
    },
    [onLayoutChange]
  );

  return (
    <GridContainer className={className} $isEditing={isEditing}>
      <GridLayout
        className="layout"
        layout={layout}
        cols={cols}
        rowHeight={rowHeight}
        width={width}
        onLayoutChange={handleLayoutChange}
        isDraggable={isEditing}
        isResizable={isEditing}
        compactType="vertical"
        preventCollision={false}
        margin={[16, 16]}
      >
        {widgets.map(widget => (
          <WidgetWrapper key={widget.id} $isEditing={isEditing}>
            {renderWidget(widget)}
          </WidgetWrapper>
        ))}
      </GridLayout>
    </GridContainer>
  );
};

export default WidgetGrid;
