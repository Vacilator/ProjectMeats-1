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
    pattern: ['triggerManualStart'],
    nextSuggestions: ['FormStepSingle', 'actionCreateRecord', 'conditionIf'],
    description: 'After manual trigger, typically add form input or business logic',
  },
  {
    pattern: ['FormStepSingle'],
    nextSuggestions: ['conditionIf', 'actionCreateRecord', 'actionEmail'],
    description: 'After form input, validate data or save to database',
  },
  {
    pattern: ['conditionIf'],
    nextSuggestions: ['actionEmail', 'actionCreateRecord', 'terminalSuccess', 'terminalFailure'],
    description: 'Conditional branches need outcome actions',
  },
  {
    pattern: ['actionCreateRecord'],
    nextSuggestions: ['actionEmail', 'terminalSuccess', 'actionUpdateRecord'],
    description: 'After creating records, notify users or complete workflow',
  },
  {
    pattern: ['actionEmail'],
    nextSuggestions: ['terminalSuccess', 'waitApproval', 'actionCreateRecord'],
    description: 'After notification, either complete or wait for action',
  },
  {
    pattern: ['waitApproval'],
    nextSuggestions: ['conditionIf', 'actionEmail', 'terminalSuccess'],
    description: 'After approval wait, branch based on decision',
  },
];

// ============================================================================
// Node Type Relationships
// ============================================================================

const NODE_AFFINITIES: Record<string, string[]> = {
  // Triggers naturally lead to forms or logic
  triggerManualStart: ['FormStepSingle', 'conditionIf', 'actionCreateRecord'],
  triggerScheduled: ['actionCreateRecord', 'actionEmail', 'FormStepSingle'],
  
  // Forms typically followed by validation or persistence
  FormStepSingle: ['conditionIf', 'actionCreateRecord', 'actionEmail', 'actionUpdateRecord'],
  FormProcessGroup: ['actionCreateRecord', 'actionEmail', 'terminalSuccess'],
  
  // Conditions branch to actions or terminals
  conditionIf: ['actionEmail', 'actionCreateRecord', 'terminalSuccess', 'terminalFailure'],
  
  // Actions can chain or terminate
  actionCreateRecord: ['actionEmail', 'actionUpdateRecord', 'terminalSuccess'],
  actionUpdateRecord: ['actionEmail', 'terminalSuccess'],
  actionEmail: ['terminalSuccess', 'waitApproval', 'actionCreateRecord'],
  actionHTTP: ['conditionIf', 'actionCreateRecord', 'terminalSuccess'],
  
  // Waits need follow-up logic
  waitApproval: ['conditionIf', 'actionEmail', 'terminalSuccess'],
  waitTimer: ['actionEmail', 'actionCreateRecord', 'terminalSuccess'],
  
  // Utilities can go anywhere
  utilityTransform: ['actionCreateRecord', 'actionEmail', 'conditionIf'],
  
  // Terminals are always end nodes
  terminalSuccess: [],
  terminalFailure: [],
  terminalCancelled: [],
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
        nodeType: 'terminalSuccess',
        label: 'Add Success Terminal',
        description: 'Complete successful workflows',
        confidence: 0.9,
        reason: 'Workflow needs at least one terminal node',
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
    const nodeType = selectedNode.type || 'default';
    
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
    
    const hasForm = nodes.some(n => n.type?.includes('Form'));
    const hasCondition = nodes.some(n => n.type?.includes('condition'));
    const hasAction = nodes.some(n => n.type?.includes('action'));
    const hasTerminal = nodes.some(n => n.type?.includes('terminal'));
    
    // Suggest forms if none exist
    if (!hasForm && nodes.length > 1) {
      suggestions.push({
        nodeType: 'FormStepSingle',
        label: 'Add Form Input',
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
        nodeType: 'terminalSuccess',
        label: 'Add Success Terminal',
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
    return nodes.some(n => n.type?.startsWith('terminal'));
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
    
    let current = triggerNode;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      sequence.push(current.type || 'default');
      
      // Find next node via edge
      const outgoingEdge = edges.find(e => e.source === current.id);
      if (!outgoingEdge) break;
      
      current = nodes.find(n => n.id === outgoingEdge.target) || null;
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
      triggerManualStart: 'Manual Start',
      triggerScheduled: 'Scheduled Trigger',
      FormStepSingle: 'Form Input',
      FormProcessGroup: 'Multi-Step Form',
      conditionIf: 'If/Then Condition',
      actionCreateRecord: 'Create Record',
      actionUpdateRecord: 'Update Record',
      actionEmail: 'Send Email',
      actionHTTP: 'HTTP Request',
      waitApproval: 'Wait for Approval',
      waitTimer: 'Wait Timer',
      terminalSuccess: 'Success',
      terminalFailure: 'Failure',
      utilityTransform: 'Transform Data',
    };
    
    return labels[nodeType] || nodeType;
  }
  
  /**
   * Get description for node type
   */
  private static getNodeDescription(nodeType: string): string {
    const descriptions: Record<string, string> = {
      triggerManualStart: 'Start workflow manually',
      triggerScheduled: 'Run workflow on schedule',
      FormStepSingle: 'Collect input from users',
      FormProcessGroup: 'Multi-page form with steps',
      conditionIf: 'Branch based on conditions',
      actionCreateRecord: 'Save data to database',
      actionUpdateRecord: 'Update existing records',
      actionEmail: 'Send notification emails',
      actionHTTP: 'Call external API',
      waitApproval: 'Pause for human decision',
      waitTimer: 'Delay execution',
      terminalSuccess: 'Mark as successful',
      terminalFailure: 'Mark as failed',
      utilityTransform: 'Transform or calculate data',
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
