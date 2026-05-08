/**
 * Tests for Step Routing Components
 *
 * Tests for StepRoutingLogic component and useStepRouting hook.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StepRoutingLogic from './StepRoutingLogic';
import useStepRouting from './useStepRouting';
import type { WorkflowStep, FormField, RoutingRule, RoutingCondition } from './StepRoutingLogic';

// ============================================================================
// TEST DATA
// ============================================================================

const mockSteps: WorkflowStep[] = [
  { id: 'step1', name: 'Request Form', order: 1, type: 'form' },
  { id: 'step2', name: 'Manager Approval', order: 2, type: 'approval' },
  { id: 'step3', name: 'Finance Review', order: 3, type: 'approval' },
  { id: 'step4', name: 'Notification', order: 4, type: 'notification' },
  { id: 'step5', name: 'Complete', order: 5, type: 'automated' },
];

const mockFields: FormField[] = [
  { id: 'amount', name: 'amount', label: 'Amount', stepId: 'step1', type: 'number' },
  { id: 'category', name: 'category', label: 'Category', stepId: 'step1', type: 'select' },
  { id: 'urgent', name: 'urgent', label: 'Urgent', stepId: 'step1', type: 'checkbox' },
  { id: 'notes', name: 'notes', label: 'Notes', stepId: 'step1', type: 'text' },
  { id: 'approved', name: 'approved', label: 'Approved', stepId: 'step2', type: 'checkbox' },
];

const createCondition = (
  fieldId: string,
  operator: RoutingCondition['operator'],
  value: RoutingCondition['value']
): RoutingCondition => ({
  id: `cond-${Math.random().toString(36).slice(2)}`,
  fieldId,
  operator,
  value,
});

const createRule = (
  sourceStepId: string,
  targetStepId: string,
  conditions: RoutingCondition[] = [],
  opts: Partial<RoutingRule> = {}
): RoutingRule => ({
  id: `rule-${Math.random().toString(36).slice(2)}`,
  name: `Route to ${targetStepId}`,
  sourceStepId,
  targetStepId,
  conditions,
  logicalOperator: 'AND',
  priority: 1,
  isDefault: false,
  ...opts,
});

// ============================================================================
// STEPROUTINGLOGIC COMPONENT TESTS
// ============================================================================

describe('StepRoutingLogic', () => {
  const defaultProps = {
    rules: [] as RoutingRule[],
    steps: mockSteps,
    fields: mockFields,
    currentStepId: 'step1',
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders step selector chips', () => {
    render(<StepRoutingLogic {...defaultProps} />);

    // Check for step names (may be within buttons)
    expect(screen.getByRole('button', { name: /📝 Request Form/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /✅ Manager Approval/i })).toBeInTheDocument();
  });

  it('shows empty state when no rules', () => {
    render(<StepRoutingLogic {...defaultProps} />);

    expect(screen.getByText(/no routing rules configured/i)).toBeInTheDocument();
  });

  it('renders add rule button', () => {
    render(<StepRoutingLogic {...defaultProps} />);

    expect(screen.getByText(/add routing rule/i)).toBeInTheDocument();
  });

  it('allows selecting different steps', () => {
    render(<StepRoutingLogic {...defaultProps} />);

    const managerApprovalBtn = screen.getByRole('button', { name: /✅ Manager Approval/i });
    fireEvent.click(managerApprovalBtn);

    // Description should update for the selected step
    expect(screen.getByText(/Configure routing rules for/i)).toBeInTheDocument();
  });

  it('adds a new rule when add button clicked', () => {
    const onChange = vi.fn();
    render(<StepRoutingLogic {...defaultProps} onChange={onChange} />);

    fireEvent.click(screen.getByText(/add routing rule/i));

    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        sourceStepId: 'step1',
        conditions: [],
        logicalOperator: 'AND',
      })
    ]));
  });

  it('renders existing rules', () => {
    const rules: RoutingRule[] = [
      createRule('step1', 'step2', [], { name: 'Fast Track', isDefault: true }),
    ];

    render(<StepRoutingLogic {...defaultProps} rules={rules} />);

    expect(screen.getByDisplayValue('Fast Track')).toBeInTheDocument();
  });

  it('shows default badge on default rule', () => {
    const rules: RoutingRule[] = [
      createRule('step1', 'step2', [], { isDefault: true }),
    ];

    render(<StepRoutingLogic {...defaultProps} rules={rules} />);

    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('can delete a rule', () => {
    const onChange = vi.fn();
    const rules: RoutingRule[] = [
      createRule('step1', 'step2', [], { name: 'Test Rule' }),
    ];

    render(<StepRoutingLogic {...defaultProps} rules={rules} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText(/delete rule/i));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('can add conditions to a rule', () => {
    const onChange = vi.fn();
    const rules: RoutingRule[] = [
      createRule('step1', 'step2', []),
    ];

    render(<StepRoutingLogic {...defaultProps} rules={rules} onChange={onChange} />);

    fireEvent.click(screen.getByText(/add condition/i));

    expect(onChange).toHaveBeenCalled();
    const call = onChange.mock.calls[0][0];
    expect(call[0].conditions.length).toBe(1);
  });

  it('displays step type badges', () => {
    const rules: RoutingRule[] = [
      createRule('step1', 'step2', [], { name: 'Test' }),
    ];

    render(<StepRoutingLogic {...defaultProps} rules={rules} />);

    // Should show step type icons/badges
    expect(screen.getAllByText(/📝/).length).toBeGreaterThan(0); // form icon
  });

  it('shows message for last step with no targets', () => {
    // Create steps where step5 is the last and has no possible targets
    const stepsWithOnlyLast: WorkflowStep[] = [
      { id: 'step5', name: 'Complete', order: 5, type: 'automated' },
    ];

    render(<StepRoutingLogic
      {...defaultProps}
      currentStepId="step5"
      steps={stepsWithOnlyLast}
    />);

    // When only one step exists, there are no target options
    expect(screen.getByText(/no routing rules configured/i)).toBeInTheDocument();
  });
});

// ============================================================================
// useStepRouting HOOK TESTS
// ============================================================================

describe('useStepRouting', () => {
  it('returns null when no rules', () => {
    const { result } = renderHook(() =>
      useStepRouting([], 'step1')
    );

    expect(result.current.getNextStep({})).toBeNull();
    expect(result.current.defaultNextStep).toBeNull();
  });

  it('returns default next step', () => {
    const rules: RoutingRule[] = [
      createRule('step1', 'step2', [], { isDefault: true }),
    ];

    const { result } = renderHook(() =>
      useStepRouting(rules, 'step1')
    );

    expect(result.current.defaultNextStep).toBe('step2');
  });

  it('evaluates equals condition correctly', () => {
    const rules: RoutingRule[] = [
      createRule('step1', 'step3', [
        createCondition('category', 'equals', 'finance'),
      ]),
      createRule('step1', 'step2', [], { isDefault: true }),
    ];

    const { result } = renderHook(() =>
      useStepRouting(rules, 'step1')
    );

    expect(result.current.getNextStep({ category: 'finance' })).toBe('step3');
    expect(result.current.getNextStep({ category: 'other' })).toBe('step2');
  });

  it('evaluates greater_than condition correctly', () => {
    const rules: RoutingRule[] = [
      createRule('step1', 'step3', [
        createCondition('amount', 'greater_than', 1000),
      ], { priority: 1 }),
      createRule('step1', 'step2', [], { isDefault: true, priority: 2 }),
    ];

    const { result } = renderHook(() =>
      useStepRouting(rules, 'step1')
    );

    expect(result.current.getNextStep({ amount: 1500 })).toBe('step3');
    expect(result.current.getNextStep({ amount: 500 })).toBe('step2');
  });

  it('evaluates less_than condition correctly', () => {
    const rules: RoutingRule[] = [
      createRule('step1', 'step4', [
        createCondition('amount', 'less_than', 100),
      ]),
    ];

    const { result } = renderHook(() =>
      useStepRouting(rules, 'step1')
    );

    expect(result.current.getNextStep({ amount: 50 })).toBe('step4');
    expect(result.current.getNextStep({ amount: 150 })).toBeNull();
  });

  it('evaluates is_empty condition correctly', () => {
    const rules: RoutingRule[] = [
      createRule('step1', 'step4', [
        createCondition('notes', 'is_empty', ''),
      ]),
    ];

    const { result } = renderHook(() =>
      useStepRouting(rules, 'step1')
    );

    expect(result.current.getNextStep({ notes: '' })).toBe('step4');
    expect(result.current.getNextStep({ notes: 'Some note' })).toBeNull();
  });

  it('evaluates is_not_empty condition correctly', () => {
    const rules: RoutingRule[] = [
      createRule('step1', 'step4', [
        createCondition('notes', 'is_not_empty', ''),
      ]),
    ];

    const { result } = renderHook(() =>
      useStepRouting(rules, 'step1')
    );

    expect(result.current.getNextStep({ notes: 'Has notes' })).toBe('step4');
    expect(result.current.getNextStep({ notes: '' })).toBeNull();
  });

  it('evaluates AND logic correctly', () => {
    const rules: RoutingRule[] = [
      createRule('step1', 'step3', [
        createCondition('amount', 'greater_than', 1000),
        createCondition('category', 'equals', 'finance'),
      ], { logicalOperator: 'AND' }),
    ];

    const { result } = renderHook(() =>
      useStepRouting(rules, 'step1')
    );

    expect(result.current.getNextStep({ amount: 1500, category: 'finance' })).toBe('step3');
    expect(result.current.getNextStep({ amount: 1500, category: 'other' })).toBeNull();
    expect(result.current.getNextStep({ amount: 500, category: 'finance' })).toBeNull();
  });

  it('evaluates OR logic correctly', () => {
    const rules: RoutingRule[] = [
      createRule('step1', 'step3', [
        createCondition('amount', 'greater_than', 1000),
        createCondition('urgent', 'equals', true),
      ], { logicalOperator: 'OR' }),
    ];

    const { result } = renderHook(() =>
      useStepRouting(rules, 'step1')
    );

    expect(result.current.getNextStep({ amount: 1500, urgent: false })).toBe('step3');
    expect(result.current.getNextStep({ amount: 500, urgent: true })).toBe('step3');
    expect(result.current.getNextStep({ amount: 500, urgent: false })).toBeNull();
  });

  it('respects rule priority', () => {
    const rules: RoutingRule[] = [
      createRule('step1', 'step4', [
        createCondition('amount', 'greater_than', 500),
      ], { priority: 2 }),
      createRule('step1', 'step3', [
        createCondition('amount', 'greater_than', 1000),
      ], { priority: 1 }),
    ];

    const { result } = renderHook(() =>
      useStepRouting(rules, 'step1')
    );

    // Higher priority rule (lower number) should match first
    expect(result.current.getNextStep({ amount: 1500 })).toBe('step3');
    expect(result.current.getNextStep({ amount: 750 })).toBe('step4');
  });

  it('returns possible next steps', () => {
    const rules: RoutingRule[] = [
      createRule('step1', 'step2', []),
      createRule('step1', 'step3', []),
      createRule('step1', 'step4', []),
    ];

    const { result } = renderHook(() =>
      useStepRouting(rules, 'step1')
    );

    const possibleSteps = result.current.getPossibleNextSteps();
    expect(possibleSteps).toContain('step2');
    expect(possibleSteps).toContain('step3');
    expect(possibleSteps).toContain('step4');
    expect(possibleSteps.length).toBe(3);
  });

  it('handles contains condition for strings', () => {
    const rules: RoutingRule[] = [
      createRule('step1', 'step3', [
        createCondition('notes', 'contains', 'urgent'),
      ]),
    ];

    const { result } = renderHook(() =>
      useStepRouting(rules, 'step1')
    );

    expect(result.current.getNextStep({ notes: 'This is URGENT request' })).toBe('step3');
    expect(result.current.getNextStep({ notes: 'Normal request' })).toBeNull();
  });

  it('handles in_list condition', () => {
    const rules: RoutingRule[] = [
      createRule('step1', 'step3', [
        createCondition('category', 'in_list', ['finance', 'hr', 'legal']),
      ]),
    ];

    const { result } = renderHook(() =>
      useStepRouting(rules, 'step1')
    );

    expect(result.current.getNextStep({ category: 'hr' })).toBe('step3');
    expect(result.current.getNextStep({ category: 'marketing' })).toBeNull();
  });

  it('isRuleSatisfied works correctly', () => {
    const rule = createRule('step1', 'step3', [
      createCondition('amount', 'greater_than', 1000),
    ]);

    const { result } = renderHook(() =>
      useStepRouting([rule], 'step1')
    );

    expect(result.current.isRuleSatisfied(rule.id, { amount: 1500 })).toBe(true);
    expect(result.current.isRuleSatisfied(rule.id, { amount: 500 })).toBe(false);
    expect(result.current.isRuleSatisfied('nonexistent', { amount: 1500 })).toBe(false);
  });

  it('evaluateRule works with provided rule object', () => {
    const rule = createRule('step1', 'step3', [
      createCondition('urgent', 'equals', true),
    ]);

    const { result } = renderHook(() =>
      useStepRouting([], 'step1')
    );

    expect(result.current.evaluateRule(rule, { urgent: true })).toBe(true);
    expect(result.current.evaluateRule(rule, { urgent: false })).toBe(false);
  });

  it('case-insensitive string comparison', () => {
    const rules: RoutingRule[] = [
      createRule('step1', 'step3', [
        createCondition('category', 'equals', 'FINANCE'),
      ]),
    ];

    const { result } = renderHook(() =>
      useStepRouting(rules, 'step1')
    );

    expect(result.current.getNextStep({ category: 'finance' })).toBe('step3');
    expect(result.current.getNextStep({ category: 'Finance' })).toBe('step3');
  });

  it('handles empty array for is_empty', () => {
    const rules: RoutingRule[] = [
      createRule('step1', 'step3', [
        createCondition('tags', 'is_empty', ''),
      ]),
    ];

    const { result } = renderHook(() =>
      useStepRouting(rules, 'step1')
    );

    expect(result.current.getNextStep({ tags: [] })).toBe('step3');
    expect(result.current.getNextStep({ tags: ['tag1'] })).toBeNull();
  });
});
