/**
 * Tests for Conditional Visibility Components
 * 
 * Tests for ConditionalVisibilityRules component and useConditionalVisibility hook.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionalVisibilityRules from './ConditionalVisibilityRules';
import useConditionalVisibility from './useConditionalVisibility';
import type { FormField, VisibilityRule, VisibilityCondition } from './ConditionalVisibilityRules';

// ============================================================================
// TEST DATA
// ============================================================================

const mockFields: FormField[] = [
  { id: 'name', name: 'name', label: 'Name', type: 'text' },
  { id: 'age', name: 'age', label: 'Age', type: 'number' },
  { id: 'country', name: 'country', label: 'Country', type: 'select', options: [
    { value: 'us', label: 'United States' },
    { value: 'uk', label: 'United Kingdom' },
    { value: 'ca', label: 'Canada' },
  ]},
  { id: 'subscribe', name: 'subscribe', label: 'Subscribe to Newsletter', type: 'checkbox' },
  { id: 'birthdate', name: 'birthdate', label: 'Birth Date', type: 'date' },
  { id: 'gender', name: 'gender', label: 'Gender', type: 'radio', options: [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ]},
];

const createCondition = (
  fieldId: string, 
  operator: VisibilityCondition['operator'], 
  value: VisibilityCondition['value']
): VisibilityCondition => ({
  id: `cond-${Math.random().toString(36).slice(2)}`,
  fieldId,
  operator,
  value,
});

const createRule = (
  targetFieldId: string,
  conditions: VisibilityCondition[],
  action: 'show' | 'hide' = 'show',
  logicalOperator: 'AND' | 'OR' = 'AND'
): VisibilityRule => ({
  id: `rule-${Math.random().toString(36).slice(2)}`,
  targetFieldId,
  conditions,
  action,
  logicalOperator,
});

// ============================================================================
// CONDITIONALVISIBILITYRULES COMPONENT TESTS
// ============================================================================

describe('ConditionalVisibilityRules', () => {
  const defaultProps = {
    rules: [] as VisibilityRule[],
    availableFields: mockFields,
    targetFieldId: 'name',
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no rules', () => {
    render(<ConditionalVisibilityRules {...defaultProps} />);
    
    expect(screen.getByText(/no visibility rules configured/i)).toBeInTheDocument();
  });

  it('renders add rule button', () => {
    render(<ConditionalVisibilityRules {...defaultProps} />);
    
    expect(screen.getByText(/add visibility rule/i)).toBeInTheDocument();
  });

  it('adds a new rule when add button clicked', () => {
    const onChange = vi.fn();
    render(<ConditionalVisibilityRules {...defaultProps} onChange={onChange} />);
    
    fireEvent.click(screen.getByText(/add visibility rule/i));
    
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        targetFieldId: 'name',
        conditions: [],
        logicalOperator: 'AND',
        action: 'show',
      })
    ]));
  });

  it('renders existing rules', () => {
    const rules: VisibilityRule[] = [
      createRule('name', [createCondition('age', 'greater_than', 18)]),
    ];
    
    render(<ConditionalVisibilityRules {...defaultProps} rules={rules} />);
    
    expect(screen.getByText('this field when:')).toBeInTheDocument();
  });

  it('can switch between show and hide actions', () => {
    const onChange = vi.fn();
    const rules: VisibilityRule[] = [
      createRule('name', [createCondition('age', 'greater_than', 18)], 'show'),
    ];
    
    render(<ConditionalVisibilityRules {...defaultProps} rules={rules} onChange={onChange} />);
    
    const actionSelect = screen.getByDisplayValue('Show');
    fireEvent.change(actionSelect, { target: { value: 'hide' } });
    
    expect(onChange).toHaveBeenCalled();
  });

  it('can add conditions to a rule', () => {
    const onChange = vi.fn();
    const rules: VisibilityRule[] = [
      createRule('name', []),
    ];
    
    render(<ConditionalVisibilityRules {...defaultProps} rules={rules} onChange={onChange} />);
    
    fireEvent.click(screen.getByText(/add condition/i));
    
    expect(onChange).toHaveBeenCalled();
    const call = onChange.mock.calls[0][0];
    expect(call[0].conditions.length).toBe(1);
  });

  it('can remove a rule', () => {
    const onChange = vi.fn();
    const rules: VisibilityRule[] = [
      createRule('name', [createCondition('age', 'greater_than', 18)]),
    ];
    
    render(<ConditionalVisibilityRules {...defaultProps} rules={rules} onChange={onChange} />);
    
    fireEvent.click(screen.getByLabelText(/delete rule/i));
    
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('excludes target field from condition field options', () => {
    const onChange = vi.fn();
    const rules: VisibilityRule[] = [
      createRule('name', [createCondition('age', 'greater_than', 18)]),
    ];
    
    render(<ConditionalVisibilityRules {...defaultProps} rules={rules} onChange={onChange} />);
    
    // The field selector should not include 'name' since it's the target
    const selects = screen.getAllByRole('combobox');
    const fieldSelect = selects.find(s => s.textContent?.includes('Age'));
    
    // Name should not be an option
    expect(screen.queryByRole('option', { name: 'Name' })).toBeNull();
  });

  it('shows logical operator toggle when multiple conditions', () => {
    const rules: VisibilityRule[] = [
      createRule('name', [
        createCondition('age', 'greater_than', 18),
        createCondition('country', 'equals', 'us'),
      ]),
    ];
    
    render(<ConditionalVisibilityRules {...defaultProps} rules={rules} />);
    
    expect(screen.getByText(/match all conditions/i)).toBeInTheDocument();
  });

  it('can toggle logical operator', () => {
    const onChange = vi.fn();
    const rules: VisibilityRule[] = [
      createRule('name', [
        createCondition('age', 'greater_than', 18),
        createCondition('country', 'equals', 'us'),
      ], 'show', 'AND'),
    ];
    
    render(<ConditionalVisibilityRules {...defaultProps} rules={rules} onChange={onChange} />);
    
    fireEvent.click(screen.getByText(/match all conditions/i));
    
    expect(onChange).toHaveBeenCalled();
    const call = onChange.mock.calls[0][0];
    expect(call[0].logicalOperator).toBe('OR');
  });

  it('shows warning when no fields available for conditions', () => {
    render(
      <ConditionalVisibilityRules 
        {...defaultProps} 
        availableFields={[{ id: 'name', name: 'name', label: 'Name', type: 'text' }]}
        targetFieldId="name"
      />
    );
    
    expect(screen.getByText(/no other fields available/i)).toBeInTheDocument();
  });
});

// ============================================================================
// useConditionalVisibility HOOK TESTS
// ============================================================================

describe('useConditionalVisibility', () => {
  const allFieldIds = ['name', 'age', 'country', 'email', 'phone'];

  it('returns all fields visible when no rules', () => {
    const { result } = renderHook(() => 
      useConditionalVisibility([], {}, allFieldIds)
    );
    
    expect(result.current.visibleFields).toEqual(allFieldIds);
    expect(result.current.hiddenFields).toEqual([]);
  });

  it('evaluates equals condition correctly', () => {
    const rules: VisibilityRule[] = [
      createRule('email', [createCondition('country', 'equals', 'us')], 'show'),
    ];
    
    const { result: visible } = renderHook(() => 
      useConditionalVisibility(rules, { country: 'us' }, allFieldIds)
    );
    
    const { result: hidden } = renderHook(() => 
      useConditionalVisibility(rules, { country: 'uk' }, allFieldIds)
    );
    
    expect(visible.current.isFieldVisible('email')).toBe(true);
    expect(hidden.current.isFieldVisible('email')).toBe(false);
  });

  it('evaluates not_equals condition correctly', () => {
    const rules: VisibilityRule[] = [
      createRule('email', [createCondition('country', 'not_equals', 'us')], 'show'),
    ];
    
    const { result } = renderHook(() => 
      useConditionalVisibility(rules, { country: 'uk' }, allFieldIds)
    );
    
    expect(result.current.isFieldVisible('email')).toBe(true);
  });

  it('evaluates contains condition correctly', () => {
    const rules: VisibilityRule[] = [
      createRule('email', [createCondition('name', 'contains', 'john')], 'show'),
    ];
    
    const { result: match } = renderHook(() => 
      useConditionalVisibility(rules, { name: 'John Doe' }, allFieldIds)
    );
    
    const { result: noMatch } = renderHook(() => 
      useConditionalVisibility(rules, { name: 'Jane Doe' }, allFieldIds)
    );
    
    expect(match.current.isFieldVisible('email')).toBe(true);
    expect(noMatch.current.isFieldVisible('email')).toBe(false);
  });

  it('evaluates greater_than condition correctly', () => {
    const rules: VisibilityRule[] = [
      createRule('email', [createCondition('age', 'greater_than', 18)], 'show'),
    ];
    
    const { result: adult } = renderHook(() => 
      useConditionalVisibility(rules, { age: 25 }, allFieldIds)
    );
    
    const { result: minor } = renderHook(() => 
      useConditionalVisibility(rules, { age: 16 }, allFieldIds)
    );
    
    expect(adult.current.isFieldVisible('email')).toBe(true);
    expect(minor.current.isFieldVisible('email')).toBe(false);
  });

  it('evaluates less_than condition correctly', () => {
    const rules: VisibilityRule[] = [
      createRule('email', [createCondition('age', 'less_than', 18)], 'show'),
    ];
    
    const { result } = renderHook(() => 
      useConditionalVisibility(rules, { age: 16 }, allFieldIds)
    );
    
    expect(result.current.isFieldVisible('email')).toBe(true);
  });

  it('evaluates is_empty condition correctly', () => {
    const rules: VisibilityRule[] = [
      createRule('email', [createCondition('name', 'is_empty', '')], 'show'),
    ];
    
    const { result: empty } = renderHook(() => 
      useConditionalVisibility(rules, { name: '' }, allFieldIds)
    );
    
    const { result: filled } = renderHook(() => 
      useConditionalVisibility(rules, { name: 'John' }, allFieldIds)
    );
    
    expect(empty.current.isFieldVisible('email')).toBe(true);
    expect(filled.current.isFieldVisible('email')).toBe(false);
  });

  it('evaluates is_not_empty condition correctly', () => {
    const rules: VisibilityRule[] = [
      createRule('email', [createCondition('name', 'is_not_empty', '')], 'show'),
    ];
    
    const { result } = renderHook(() => 
      useConditionalVisibility(rules, { name: 'John' }, allFieldIds)
    );
    
    expect(result.current.isFieldVisible('email')).toBe(true);
  });

  it('evaluates AND logic correctly', () => {
    const rules: VisibilityRule[] = [
      createRule('email', [
        createCondition('age', 'greater_than', 18),
        createCondition('country', 'equals', 'us'),
      ], 'show', 'AND'),
    ];
    
    const { result: bothMatch } = renderHook(() => 
      useConditionalVisibility(rules, { age: 25, country: 'us' }, allFieldIds)
    );
    
    const { result: oneMatch } = renderHook(() => 
      useConditionalVisibility(rules, { age: 25, country: 'uk' }, allFieldIds)
    );
    
    expect(bothMatch.current.isFieldVisible('email')).toBe(true);
    expect(oneMatch.current.isFieldVisible('email')).toBe(false);
  });

  it('evaluates OR logic correctly', () => {
    const rules: VisibilityRule[] = [
      createRule('email', [
        createCondition('age', 'greater_than', 18),
        createCondition('country', 'equals', 'us'),
      ], 'show', 'OR'),
    ];
    
    const { result: oneMatch } = renderHook(() => 
      useConditionalVisibility(rules, { age: 16, country: 'us' }, allFieldIds)
    );
    
    const { result: noneMatch } = renderHook(() => 
      useConditionalVisibility(rules, { age: 16, country: 'uk' }, allFieldIds)
    );
    
    expect(oneMatch.current.isFieldVisible('email')).toBe(true);
    expect(noneMatch.current.isFieldVisible('email')).toBe(false);
  });

  it('evaluates hide action correctly', () => {
    const rules: VisibilityRule[] = [
      createRule('email', [createCondition('country', 'equals', 'us')], 'hide'),
    ];
    
    const { result: shouldHide } = renderHook(() => 
      useConditionalVisibility(rules, { country: 'us' }, allFieldIds)
    );
    
    const { result: shouldShow } = renderHook(() => 
      useConditionalVisibility(rules, { country: 'uk' }, allFieldIds)
    );
    
    expect(shouldHide.current.isFieldVisible('email')).toBe(false);
    expect(shouldShow.current.isFieldVisible('email')).toBe(true);
  });

  it('returns correct hidden fields list', () => {
    const rules: VisibilityRule[] = [
      createRule('email', [createCondition('country', 'equals', 'us')], 'show'),
      createRule('phone', [createCondition('country', 'equals', 'uk')], 'show'),
    ];
    
    const { result } = renderHook(() => 
      useConditionalVisibility(rules, { country: 'us' }, allFieldIds)
    );
    
    expect(result.current.visibleFields).toContain('email');
    expect(result.current.hiddenFields).toContain('phone');
  });

  it('handles multiple rules for same field (OR between rules)', () => {
    const rules: VisibilityRule[] = [
      createRule('email', [createCondition('country', 'equals', 'us')], 'show'),
      createRule('email', [createCondition('country', 'equals', 'uk')], 'show'),
    ];
    
    const { result: us } = renderHook(() => 
      useConditionalVisibility(rules, { country: 'us' }, allFieldIds)
    );
    
    const { result: uk } = renderHook(() => 
      useConditionalVisibility(rules, { country: 'uk' }, allFieldIds)
    );
    
    const { result: ca } = renderHook(() => 
      useConditionalVisibility(rules, { country: 'ca' }, allFieldIds)
    );
    
    expect(us.current.isFieldVisible('email')).toBe(true);
    expect(uk.current.isFieldVisible('email')).toBe(true);
    expect(ca.current.isFieldVisible('email')).toBe(false);
  });

  it('handles array contains for multiselect', () => {
    const rules: VisibilityRule[] = [
      createRule('email', [createCondition('tags', 'contains', 'vip')], 'show'),
    ];
    
    const { result: hasTag } = renderHook(() => 
      useConditionalVisibility(rules, { tags: ['vip', 'active'] }, allFieldIds)
    );
    
    const { result: noTag } = renderHook(() => 
      useConditionalVisibility(rules, { tags: ['basic'] }, allFieldIds)
    );
    
    expect(hasTag.current.isFieldVisible('email')).toBe(true);
    expect(noTag.current.isFieldVisible('email')).toBe(false);
  });

  it('handles in_list operator', () => {
    const rules: VisibilityRule[] = [
      createRule('email', [createCondition('country', 'in_list', ['us', 'uk', 'ca'])], 'show'),
    ];
    
    const { result: inList } = renderHook(() => 
      useConditionalVisibility(rules, { country: 'uk' }, allFieldIds)
    );
    
    const { result: notInList } = renderHook(() => 
      useConditionalVisibility(rules, { country: 'de' }, allFieldIds)
    );
    
    expect(inList.current.isFieldVisible('email')).toBe(true);
    expect(notInList.current.isFieldVisible('email')).toBe(false);
  });

  it('handles boolean checkbox values', () => {
    const rules: VisibilityRule[] = [
      createRule('email', [createCondition('subscribe', 'equals', true)], 'show'),
    ];
    
    const { result: checked } = renderHook(() => 
      useConditionalVisibility(rules, { subscribe: true }, allFieldIds)
    );
    
    const { result: unchecked } = renderHook(() => 
      useConditionalVisibility(rules, { subscribe: false }, allFieldIds)
    );
    
    expect(checked.current.isFieldVisible('email')).toBe(true);
    expect(unchecked.current.isFieldVisible('email')).toBe(false);
  });

  it('is case-insensitive for string comparisons', () => {
    const rules: VisibilityRule[] = [
      createRule('email', [createCondition('name', 'equals', 'john')], 'show'),
    ];
    
    const { result } = renderHook(() => 
      useConditionalVisibility(rules, { name: 'JOHN' }, allFieldIds)
    );
    
    expect(result.current.isFieldVisible('email')).toBe(true);
  });
});
