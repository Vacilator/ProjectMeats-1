/**
 * Forms & Flows Catalog Page
 * 
 * Browse and start new form flows (formerly WorkflowList).
 * Implements Phase 1 of the Forms & Flows Enhancement Plan.
 * 
 * Created: 2026-02-03
 * 
 * Features:
 * - Browse available form templates
 * - Search and filter
 * - Category organization
 * - Recent/Favorites section (future)
 */
import React from 'react';
import styled from 'styled-components';
// Re-use the existing WorkflowList component
import { WorkflowList } from '../Workflows';

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  /* Catalog uses WorkflowList styling */
`;

// ============================================================================
// Component
// ============================================================================

const FormsFlowsCatalog: React.FC = () => {
  // Re-use the existing WorkflowList component which has all the catalog functionality
  return (
    <Container>
      <WorkflowList />
    </Container>
  );
};

export default FormsFlowsCatalog;
