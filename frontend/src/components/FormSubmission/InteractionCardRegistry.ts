/**
 * Interaction Card Registry
 * 
 * Phase 4: Hybrid Task Renderer
 * Defines all interaction card types for workflow execution.
 * 
 * Interaction cards are non-form workflow steps that require user interaction:
 * - Document uploads
 * - Manual approvals
 * - AI verification results
 * - Payment processing
 * - Data validation
 * 
 * Created: 2026-02-12 - Phase 4 Hybrid Task Renderer Implementation
 */

import { LucideIcon, FileUp, CheckSquare, Cpu, DollarSign, AlertCircle } from 'lucide-react';
import { WorkflowContext } from './hooks/useWorkflowContext';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface InteractionCardProps {
  /** Current workflow node */
  node: any;
  
  /** Workflow context for data access */
  context: WorkflowContext;
  
  /** Callback when card is completed */
  onComplete: (data: Record<string, any>) => void;
  
  /** Callback when card needs to wait (async) */
  onWait?: () => void;
  
  /** Read-only mode */
  readOnly?: boolean;
}

export interface InteractionCardDefinition {
  /** Node type identifier */
  nodeType: string;
  
  /** Display title */
  title: string;
  
  /** Icon component */
  icon: LucideIcon;
  
  /** Card renderer component */
  renderer: React.ComponentType<InteractionCardProps>;
  
  /** Required fields for completion */
  requiredFields: string[];
  
  /** Function to check if card is complete */
  completionCondition: (data: any) => boolean;
  
  /** Optional: Auto-advance after completion */
  autoAdvance?: boolean;
  
  /** Optional: Requires async processing */
  requiresPolling?: boolean;
  
  /** Optional: Can be skipped */
  skippable?: boolean;
}

// ============================================================================
// Card Components (Forward Declarations)
// ============================================================================

// Import card components (created below)
import { DocumentUploadCard } from './cards/DocumentUploadCard';
import { ApprovalDecisionCard } from './cards/ApprovalDecisionCard';
import { AIVerificationCard } from './cards/AIVerificationCard';
import { PaymentCard } from './cards/PaymentCard';
import { ValidationCard } from './cards/ValidationCard';

// ============================================================================
// Interaction Card Registry
// ============================================================================

/**
 * Central registry of all interaction card types.
 * 
 * To add a new card type:
 * 1. Create component in ./cards/
 * 2. Add definition here
 * 3. Export from index.ts
 * 4. Update node type registry if needed
 */
export const INTERACTION_CARDS: Record<string, InteractionCardDefinition> = {
  // Document Upload Card
  wait_for_document: {
    nodeType: 'pendingDocument',
    title: 'Upload Required Document',
    icon: FileUp,
    renderer: DocumentUploadCard,
    requiredFields: ['file_uuid', 'file_name', 'file_size'],
    completionCondition: (data) => !!data.file_uuid && !!data.file_name,
    autoAdvance: true,
    skippable: false,
  },
  
  // Manual Approval Card
  manual_approval: {
    nodeType: 'pendingApproval',
    title: 'Approval Required',
    icon: CheckSquare,
    renderer: ApprovalDecisionCard,
    requiredFields: ['decision', 'comment', 'approver_id'],
    completionCondition: (data) => data.decision !== undefined && !!data.comment,
    autoAdvance: true,
    skippable: false,
  },
  
  // AI Verification Card
  ai_verification: {
    nodeType: 'actionScript',
    title: 'AI Verification in Progress',
    icon: Cpu,
    renderer: AIVerificationCard,
    requiredFields: ['confidence_score', 'verification_result'],
    completionCondition: (data) => 
      data.confidence_score !== undefined && 
      data.verification_result !== undefined,
    autoAdvance: true,
    requiresPolling: true,
    skippable: false,
  },
  
  // Payment Processing Card
  payment_processing: {
    nodeType: 'pendingPayment',
    title: 'Payment Required',
    icon: DollarSign,
    renderer: PaymentCard,
    requiredFields: ['transaction_id', 'payment_status'],
    completionCondition: (data) => data.payment_status === 'completed',
    autoAdvance: true,
    requiresPolling: true,
    skippable: false,
  },
  
  // Data Validation Card
  data_validation: {
    nodeType: 'pendingResponse',
    title: 'Data Validation Required',
    icon: AlertCircle,
    renderer: ValidationCard,
    requiredFields: ['validation_status'],
    completionCondition: (data) => data.validation_status === 'approved',
    autoAdvance: false,
    skippable: true,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get card definition by node type
 */
export function getCardDefinition(nodeType: string): InteractionCardDefinition | undefined {
  return Object.values(INTERACTION_CARDS).find(card => card.nodeType === nodeType);
}

/**
 * Get card definition by interaction type key
 */
export function getCardDefinitionByKey(key: string): InteractionCardDefinition | undefined {
  return INTERACTION_CARDS[key];
}

/**
 * Check if node type is an interaction card
 */
export function isInteractionCard(nodeType: string): boolean {
  return Object.values(INTERACTION_CARDS).some(card => card.nodeType === nodeType);
}

/**
 * Get all card definitions as array
 */
export function getAllCardDefinitions(): InteractionCardDefinition[] {
  return Object.values(INTERACTION_CARDS);
}

/**
 * Check if card data meets completion condition
 */
export function isCardComplete(
  cardKey: string,
  data: Record<string, any>
): boolean {
  const cardDef = INTERACTION_CARDS[cardKey];
  if (!cardDef) return false;
  
  // Check required fields
  const hasRequiredFields = cardDef.requiredFields.every(field => {
    const value = data[field];
    return value !== undefined && value !== null && value !== '';
  });
  
  if (!hasRequiredFields) return false;
  
  // Check completion condition
  return cardDef.completionCondition(data);
}

/**
 * Get card by node data (detects interaction type from node config)
 */
export function detectCardType(nodeData: any): InteractionCardDefinition | undefined {
  // Check for explicit interaction type
  if (nodeData.interactionType) {
    return INTERACTION_CARDS[nodeData.interactionType];
  }
  
  // Fallback: match by node type
  if (nodeData.type) {
    return getCardDefinition(nodeData.type);
  }
  
  return undefined;
}

export default INTERACTION_CARDS;
