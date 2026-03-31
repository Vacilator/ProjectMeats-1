/**
 * AI Node Suggestions Service
 * 
 * Provides intelligent node placement suggestions based on:
 * - Current workflow context
 * - Node type relationships
 * - Common workflow patterns
 * - User behavior
 * 
 * Created: 2026-02-26 - Advanced Features
 */

import { Node, Edge } from '@xyflow/react';

// ============================================================================
// Canonical Node Type IDs
// ============================================================================

/**
 * Canonicalize legacy / mislabeled node type IDs into the current registry IDs.
 *
 * IMPORTANT: UnifiedFlowEditor expects IDs that exist in NODE_TYPE_REGISTRY.
 */
export function canonicalizeNodeTypeId(rawType: string): string {
  const type = String(rawType ?? '');
  const map: Record<string, string> = {
    // Triggers
    triggerManualStart: 'triggerManual',
    triggerManual: 'triggerManual',
    triggerScheduled: 'triggerSchedule',
    triggerSchedule: 'triggerSchedule',

    // Generic legacy categories (from older prompt/fallback versions)
    trigger: 'triggerManual',
    input: 'form',
    condition: 'conditionIf',
    approval: 'pendingApproval',
    action: 'actionCreateRecord',
    end: 'endSuccess',

    // Forms (legacy variants)
    FormStepSingle: 'form',
    formStepSingle: 'form',
    formStep: 'form',
    formStepSingleNode: 'form',
    form: 'form',

    // Containers
    FormProcessGroup: 'formProcess',
    formProcessGroup: 'formProcess',
    formMultiStepContainer: 'formProcess',
    formBook: 'formProcess',
    formProcess: 'formProcess',

    // Legacy wait/utility/terminal IDs
    waitApproval: 'pendingApproval',
    waitTimer: 'timerDelay',
    utilityTransform: 'dataTransform',

    terminalSuccess: 'endSuccess',
    terminalFailure: 'endError',
    terminalCancelled: 'endCancel',

    // Everything else stays as-is
  };

  return map[type] || type;
}

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface NodeSuggestion {
  nodeType: string;
  label: string;
  description: string;
  confidence: number; // 0-1
  reason: string;
  position?: { x: number; y: number };
}

export interface WorkflowPattern {
  pattern: string[];
  nextSuggestions: string[];
  description: string;
}

// ============================================================================
// Common Workflow Patterns
// ============================================================================

const WORKFLOW_PATTERNS: WorkflowPattern[] = [
  {
    pattern: ['triggerManual'],
    nextSuggestions: ['form', 'actionCreateRecord', 'conditionIf'],
    description: 'After manual trigger, typically add form input or business logic',
  },
  {
    pattern: ['form'],
    nextSuggestions: ['conditionIf', 'actionCreateRecord', 'actionEmail'],
    description: 'After form input, validate data or save to database',
  },
  {
    pattern: ['conditionIf'],
    nextSuggestions: ['actionEmail', 'actionCreateRecord', 'endSuccess', 'endError'],
    description: 'Conditional branches need outcome actions',
  },
  {
    pattern: ['actionCreateRecord'],
    nextSuggestions: ['actionEmail', 'endSuccess', 'actionUpdateRecord'],
    description: 'After creating records, notify users or complete workflow',
  },
  {
    pattern: ['actionEmail'],
    nextSuggestions: ['endSuccess', 'pendingApproval', 'actionCreateRecord'],
    description: 'After notification, either complete or wait for action',
  },
  {
    pattern: ['pendingApproval'],
    nextSuggestions: ['conditionIf', 'actionEmail', 'endSuccess'],
    description: 'After approval wait, branch based on decision',
  },
  // ── Supply-chain domain patterns ──────────────────────────────────────────
  // Cold-storage monitoring
  {
    pattern: ['triggerSchedule', 'actionHTTP'],
    nextSuggestions: ['actionCreateRecord', 'conditionIf', 'dataTransform'],
    description: 'After polling IoT sensor, log the reading and evaluate thresholds',
  },
  {
    pattern: ['actionHTTP', 'actionCreateRecord', 'conditionIf'],
    nextSuggestions: ['actionEmail', 'actionUpdateRecord', 'endSuccess'],
    description: 'Cold-storage: after breach check, alert QA or mark compliant',
  },
  {
    pattern: ['conditionIf', 'actionEmail', 'actionUpdateRecord'],
    nextSuggestions: ['pendingApproval', 'endSuccess', 'endError'],
    description: 'Cold-storage: after flagging zone, wait for QA disposition',
  },
  // Quality inspection
  {
    pattern: ['triggerManual', 'form', 'actionCreateRecord'],
    nextSuggestions: ['conditionIf', 'actionEmail', 'pendingApproval'],
    description: 'Quality inspection: after recording lot data, evaluate pass/fail',
  },
  {
    pattern: ['conditionIf', 'actionCreateRecord'],
    nextSuggestions: ['actionEmail', 'pendingApproval', 'endSuccess', 'endError'],
    description: 'Quality inspection: NCR raised — notify stakeholders and await disposition',
  },
  {
    pattern: ['pendingApproval', 'actionCreateRecord'],
    nextSuggestions: ['endSuccess', 'endError', 'actionEmail'],
    description: 'Quality inspection: disposition approved — close with CAPA or accept lot',
  },
  // Carrier compliance
  {
    pattern: ['triggerManual', 'actionHTTP', 'conditionIf'],
    nextSuggestions: ['form', 'actionEmail', 'endError'],
    description: 'Carrier compliance: after vetting, run pre-trip inspection or reject',
  },
  {
    pattern: ['form', 'conditionIf', 'actionCreateRecord'],
    nextSuggestions: ['pendingApproval', 'actionEmail', 'endError'],
    description: 'Carrier compliance: after BOL creation, capture driver e-signature',
  },
  {
    // Two consecutive waitApproval nodes is intentional here:
    // first waits for the driver's e-signature on the BOL,
    // second waits for the receiver's proof-of-delivery (POD) submission.
    // An intermediate actionCreateRecord (BOL generation) separates them in the
    // full template; this pattern anchors the tail of that sequence.
    pattern: ['pendingApproval', 'pendingApproval', 'actionCreateRecord'],
    nextSuggestions: ['endSuccess', 'actionEmail'],
    description: 'Carrier compliance: POD received — close freight audit',
  },
];

// ============================================================================
// Node Type Relationships
// ============================================================================

const NODE_AFFINITIES: Record<string, string[]> = {
  // Triggers naturally lead to forms or logic
  triggerManual: ['form', 'conditionIf', 'actionCreateRecord'],
  triggerSchedule: ['actionHTTP', 'actionCreateRecord', 'actionEmail', 'form'],
  triggerWebhook: ['actionCreateRecord', 'conditionIf', 'actionHTTP'],

  // Forms typically followed by validation or persistence
  form: ['conditionIf', 'actionCreateRecord', 'actionEmail', 'actionUpdateRecord'],
  formProcess: ['actionCreateRecord', 'actionEmail', 'endSuccess'],

  // Conditions branch to actions or terminals
  conditionIf: ['actionEmail', 'actionCreateRecord', 'endSuccess', 'endError'],

  // Actions can chain or terminate
  actionCreateRecord: ['actionEmail', 'actionUpdateRecord', 'endSuccess', 'pendingApproval'],
  actionUpdateRecord: ['actionEmail', 'endSuccess'],
  actionEmail: ['endSuccess', 'pendingApproval', 'actionCreateRecord'],
  // HTTP actions (IoT polls, FMCSA queries) feed into record-creation or conditions
  actionHTTP: ['actionCreateRecord', 'conditionIf', 'dataTransform', 'endSuccess'],

  // Waits need follow-up logic
  pendingApproval: ['conditionIf', 'actionEmail', 'actionCreateRecord', 'endSuccess', 'endError'],
  timerDelay: ['actionEmail', 'actionCreateRecord', 'endSuccess'],

  // Utilities can go anywhere
  dataTransform: ['actionCreateRecord', 'actionEmail', 'conditionIf'],

  // Terminals are always end nodes
  endSuccess: [],
  endError: [],
  endCancel: [],
};

// ============================================================================
// Suggestion Engine
// ============================================================================

export class AINodeSuggestionService {
  /**
   * Get intelligent node suggestions based on workflow context
   */
  public static getSuggestions(
    nodes: Node[],
    edges: Edge[],
    selectedNodeId?: string
  ): NodeSuggestion[] {
    const suggestions: NodeSuggestion[] = [];
    
    // 1. If node selected, suggest based on its outputs
    if (selectedNodeId) {
      const selectedNode = nodes.find(n => n.id === selectedNodeId);
      if (selectedNode) {
        const contextualSuggestions = this.getContextualSuggestions(selectedNode, nodes, edges);
        suggestions.push(...contextualSuggestions);
      }
    }
    
    // 2. Pattern-based suggestions (analyze workflow structure)
    const patternSuggestions = this.getPatternSuggestions(nodes, edges);
    suggestions.push(...patternSuggestions);
    
    // 3. Gap analysis (missing common nodes)
    const gapSuggestions = this.getGapSuggestions(nodes, edges);
    suggestions.push(...gapSuggestions);
    
    // 4. Terminal suggestions (workflows need end states)
    if (!this.hasTerminals(nodes)) {
      suggestions.push({
        nodeType: 'endSuccess',
        label: 'Add Success End',
        description: 'Complete successful workflows',
        confidence: 0.9,
        reason: 'Workflow needs at least one end node',
      });
    }
    
    // Sort by confidence and deduplicate
    return this.deduplicateAndSort(suggestions);
  }
  
  /**
   * Get suggestions based on selected node's type
   */
  private static getContextualSuggestions(
    selectedNode: Node,
    nodes: Node[],
    edges: Edge[]
  ): NodeSuggestion[] {
    const suggestions: NodeSuggestion[] = [];
    const nodeType = canonicalizeNodeTypeId(selectedNode.type || 'default');
    
    // Get typical next nodes for this type
    const affinities = NODE_AFFINITIES[nodeType] || [];
    
    affinities.forEach((suggestedType, index) => {
      const confidence = 0.8 - (index * 0.1); // Decay confidence for lower-ranked suggestions
      
      suggestions.push({
        nodeType: suggestedType,
        label: this.getNodeLabel(suggestedType),
        description: this.getNodeDescription(suggestedType),
        confidence,
        reason: `Commonly follows ${this.getNodeLabel(nodeType)}`,
        position: this.suggestPosition(selectedNode, nodes),
      });
    });
    
    return suggestions;
  }
  
  /**
   * Get suggestions based on workflow patterns
   */
  private static getPatternSuggestions(nodes: Node[], edges: Edge[]): NodeSuggestion[] {
    const suggestions: NodeSuggestion[] = [];
    
    // Extract node type sequence
    const nodeSequence = this.extractNodeSequence(nodes, edges);
    
    // Match against known patterns
    WORKFLOW_PATTERNS.forEach(pattern => {
      if (this.matchesPattern(nodeSequence, pattern.pattern)) {
        pattern.nextSuggestions.forEach((suggestedType, index) => {
          const confidence = 0.7 - (index * 0.1);
          
          suggestions.push({
            nodeType: suggestedType,
            label: this.getNodeLabel(suggestedType),
            description: pattern.description,
            confidence,
            reason: 'Matches common workflow pattern',
          });
        });
      }
    });
    
    return suggestions;
  }
  
  /**
   * Get suggestions for missing workflow components
   */
  private static getGapSuggestions(nodes: Node[], edges: Edge[]): NodeSuggestion[] {
    const suggestions: NodeSuggestion[] = [];
    
    const canonicalTypes = nodes.map((n) => canonicalizeNodeTypeId(n.type || ''));

    const hasForm = canonicalTypes.some((t) => t === 'form' || t === 'formProcess');
    const hasCondition = canonicalTypes.some((t) => t.startsWith('condition'));
    const hasAction = canonicalTypes.some((t) => t.startsWith('action'));
    const hasTerminal = canonicalTypes.some((t) => t.startsWith('end'));
    
    // Suggest forms if none exist
    if (!hasForm && nodes.length > 1) {
      suggestions.push({
        nodeType: 'form',
        label: 'Add Form Step',
        description: 'Collect data from users',
        confidence: 0.6,
        reason: 'Workflow lacks user input',
      });
    }
    
    // Suggest conditions if actions exist but no branching
    if (hasAction && !hasCondition) {
      suggestions.push({
        nodeType: 'conditionIf',
        label: 'Add Conditional Logic',
        description: 'Branch workflow based on conditions',
        confidence: 0.55,
        reason: 'Add decision points for flexibility',
      });
    }
    
    // Suggest terminals if workflow has content but no end
    if (nodes.length > 2 && !hasTerminal) {
      suggestions.push({
        nodeType: 'endSuccess',
        label: 'Add Success End',
        description: 'Mark successful completion',
        confidence: 0.7,
        reason: 'Workflow needs clear end state',
      });
    }
    
    return suggestions;
  }
  
  /**
   * Check if workflow has terminal nodes
   */
  private static hasTerminals(nodes: Node[]): boolean {
    return nodes.some((n) => canonicalizeNodeTypeId(n.type || '').startsWith('end'));
  }
  
  /**
   * Extract linear node sequence from workflow
   */
  private static extractNodeSequence(nodes: Node[], edges: Edge[]): string[] {
    // Simple BFS traversal for now
    if (nodes.length === 0) return [];
    
    const sequence: string[] = [];
    const visited = new Set<string>();
    
    // Find trigger node (starting point)
    const triggerNode = nodes.find(n => n.type?.startsWith('trigger'));
    if (!triggerNode) return nodes.map(n => n.type || 'default');
    
    let current: (typeof triggerNode) | undefined = triggerNode;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      sequence.push(canonicalizeNodeTypeId(current.type || 'default'));
      
      // Find next node via edge
      const currentId: string = current.id;
      const outgoingEdge: Edge | undefined = edges.find((e) => e.source === currentId);
      if (!outgoingEdge) break;

      const next: Node | undefined = nodes.find((n) => n.id === outgoingEdge.target);
      if (!next) break;
      current = next;
    }
    
    return sequence;
  }
  
  /**
   * Match node sequence against pattern
   */
  private static matchesPattern(sequence: string[], pattern: string[]): boolean {
    if (sequence.length < pattern.length) return false;
    
    // Check if pattern exists as substring in sequence
    for (let i = 0; i <= sequence.length - pattern.length; i++) {
      let matches = true;
      for (let j = 0; j < pattern.length; j++) {
        if (sequence[i + j] !== pattern[j]) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
    }
    
    return false;
  }
  
  /**
   * Suggest position for new node relative to selected node
   */
  private static suggestPosition(selectedNode: Node, allNodes: Node[]): { x: number; y: number } {
    const baseX = selectedNode.position.x;
    const baseY = selectedNode.position.y;
    
    // Position below and to the right
    const offsetX = 250;
    const offsetY = 150;
    
    // Find available position (avoid overlaps)
    let x = baseX + offsetX;
    let y = baseY + offsetY;
    
    // Check for overlaps and adjust
    const hasOverlap = (testX: number, testY: number) => {
      return allNodes.some(n => {
        const dx = Math.abs(n.position.x - testX);
        const dy = Math.abs(n.position.y - testY);
        return dx < 200 && dy < 100;
      });
    };
    
    // Try a few positions
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!hasOverlap(x, y)) break;
      y += 100; // Move down if position taken
    }
    
    return { x, y };
  }
  
  /**
   * Get human-readable label for node type
   */
  private static getNodeLabel(nodeType: string): string {
    const labels: Record<string, string> = {
      triggerManual: 'Manual Trigger',
      triggerSchedule: 'Schedule Trigger',
      triggerWebhook: 'Webhook Trigger',
      form: 'Form Step',
      formProcess: 'Form Process',
      conditionIf: 'If/Then Condition',
      actionCreateRecord: 'Create Record',
      actionUpdateRecord: 'Update Record',
      actionEmail: 'Send Email',
      actionHTTP: 'HTTP / IoT Request',
      pendingApproval: 'Approval Required',
      timerDelay: 'Delay',
      endSuccess: 'Success End',
      endError: 'Error End',
      endCancel: 'Cancel End',
      dataTransform: 'Transform Data',
    };
    
    return labels[nodeType] || nodeType;
  }
  
  /**
   * Get description for node type
   */
  private static getNodeDescription(nodeType: string): string {
    const descriptions: Record<string, string> = {
      triggerManual: 'Start workflow manually',
      triggerSchedule: 'Run workflow on schedule (cron)',
      triggerWebhook: 'Start on external event or IoT signal',
      form: 'Collect input from users',
      formProcess: 'Multi-step container (Form Process)',
      conditionIf: 'Branch based on conditions',
      actionCreateRecord: 'Save data to database',
      actionUpdateRecord: 'Update existing records',
      actionEmail: 'Send notification emails',
      actionHTTP: 'Call external API or IoT gateway',
      pendingApproval: 'Wait for internal approval',
      timerDelay: 'Wait for a specified duration',
      endSuccess: 'Successful completion of workflow',
      endError: 'Error termination of workflow',
      endCancel: 'User-initiated cancellation',
      dataTransform: 'Transform or calculate data',
    };
    
    return descriptions[nodeType] || 'Workflow node';
  }
  
  /**
   * Remove duplicate suggestions and sort by confidence
   */
  private static deduplicateAndSort(suggestions: NodeSuggestion[]): NodeSuggestion[] {
    const uniqueMap = new Map<string, NodeSuggestion>();
    
    // Keep highest confidence version of each node type
    suggestions.forEach(suggestion => {
      const existing = uniqueMap.get(suggestion.nodeType);
      if (!existing || suggestion.confidence > existing.confidence) {
        uniqueMap.set(suggestion.nodeType, suggestion);
      }
    });
    
    // Convert back to array and sort by confidence
    return Array.from(uniqueMap.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Top 5 suggestions
  }
}
