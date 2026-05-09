import { describe, it, expect } from 'vitest';
import {
  evaluateRules,
  isFieldVisible,
  isStepVisible,
  getFilteredOptions,
  getAutoSetValue,
  flatDataToFormData,
  getVisibleSteps,
  getVisibleFields,
  type ConditionalRule,
  type FormData,
  type VisibilityState,
} from './formRuleEngine';

// ─── helpers ────────────────────────────────────────────────────────────────────

const emptyVisibility = (): VisibilityState => ({
  hiddenFields: new Set(),
  hiddenSteps: new Set(),
  filteredOptions: new Map(),
  setValues: new Map(),
});

const rule = (
  partial: Partial<ConditionalRule> & Pick<ConditionalRule, 'conditions' | 'actions'>
): ConditionalRule => ({
  id: partial.id ?? 'r1',
  name: partial.name ?? 'Test Rule',
  order: partial.order ?? 0,
  condition_logic: partial.condition_logic ?? 'and',
  conditions: partial.conditions,
  actions: partial.actions,
});

// ─── evaluateRules: basic condition operators ───────────────────────────────────

describe('evaluateRules — condition operators', () => {
  const formData: FormData = {
    step1: { status: 'active', count: 5, name: 'Acme', tags: '' },
  };

  it('eq: matches equal strings (case-insensitive)', () => {
    const r = rule({
      conditions: [{ field: 'step1.status', operator: 'eq', value: 'Active' }],
      actions: [{ action: 'hide_fields', params: { fields: ['step1.name'] } }],
    });
    const state = evaluateRules([r], formData);
    expect(state.hiddenFields.has('step1.name')).toBe(true);
  });

  it('neq: matches not-equal', () => {
    const r = rule({
      conditions: [{ field: 'step1.status', operator: 'neq', value: 'inactive' }],
      actions: [{ action: 'hide_steps', params: { steps: ['step2'] } }],
    });
    const state = evaluateRules([r], formData);
    expect(state.hiddenSteps.has('step2')).toBe(true);
  });

  it('gt: numeric greater than', () => {
    const r = rule({
      conditions: [{ field: 'step1.count', operator: 'gt', value: 3 }],
      actions: [{ action: 'display_fields', params: { fields: ['step1.extra'] } }],
    });
    const state = evaluateRules([r], formData);
    // display_fields removes from hidden; since it was never hidden, set is empty
    expect(state.hiddenFields.has('step1.extra')).toBe(false);
  });

  it('lt: numeric less than', () => {
    const r = rule({
      conditions: [{ field: 'step1.count', operator: 'lt', value: 10 }],
      actions: [{ action: 'hide_fields', params: { fields: ['step1.name'] } }],
    });
    const state = evaluateRules([r], formData);
    expect(state.hiddenFields.has('step1.name')).toBe(true);
  });

  it('gte: numeric greater than or equal', () => {
    const r = rule({
      conditions: [{ field: 'step1.count', operator: 'gte', value: 5 }],
      actions: [{ action: 'hide_fields', params: { fields: ['step1.tags'] } }],
    });
    const state = evaluateRules([r], formData);
    expect(state.hiddenFields.has('step1.tags')).toBe(true);
  });

  it('lte: numeric less than or equal', () => {
    const r = rule({
      conditions: [{ field: 'step1.count', operator: 'lte', value: 5 }],
      actions: [{ action: 'hide_fields', params: { fields: ['step1.tags'] } }],
    });
    const state = evaluateRules([r], formData);
    expect(state.hiddenFields.has('step1.tags')).toBe(true);
  });

  it('contains: substring match', () => {
    const r = rule({
      conditions: [{ field: 'step1.name', operator: 'contains', value: 'acm' }],
      actions: [{ action: 'hide_fields', params: { fields: ['step1.status'] } }],
    });
    const state = evaluateRules([r], formData);
    expect(state.hiddenFields.has('step1.status')).toBe(true);
  });

  it('not_contains: substring non-match', () => {
    const r = rule({
      conditions: [{ field: 'step1.name', operator: 'not_contains', value: 'xyz' }],
      actions: [{ action: 'hide_fields', params: { fields: ['step1.tags'] } }],
    });
    const state = evaluateRules([r], formData);
    expect(state.hiddenFields.has('step1.tags')).toBe(true);
  });

  it('is_empty: true for empty string', () => {
    const r = rule({
      conditions: [{ field: 'step1.tags', operator: 'is_empty' }],
      actions: [{ action: 'hide_fields', params: { fields: ['step1.count'] } }],
    });
    const state = evaluateRules([r], formData);
    expect(state.hiddenFields.has('step1.count')).toBe(true);
  });

  it('is_not_empty: true for non-empty value', () => {
    const r = rule({
      conditions: [{ field: 'step1.name', operator: 'is_not_empty' }],
      actions: [{ action: 'hide_steps', params: { step_id: 'step3' } }],
    });
    const state = evaluateRules([r], formData);
    expect(state.hiddenSteps.has('step3')).toBe(true);
  });

  it('is_empty: false for numbers (zero included)', () => {
    const data: FormData = { s: { val: 0 } };
    const r = rule({
      conditions: [{ field: 's.val', operator: 'is_empty' }],
      actions: [{ action: 'hide_fields', params: { fields: ['s.x'] } }],
    });
    const state = evaluateRules([r], data);
    expect(state.hiddenFields.has('s.x')).toBe(false);
  });
});

// ─── evaluateRules: condition logic (AND / OR) ──────────────────────────────────

describe('evaluateRules — condition logic', () => {
  const formData: FormData = {
    s: { a: 'yes', b: 'no' },
  };

  it('AND: all conditions must match', () => {
    const r = rule({
      condition_logic: 'and',
      conditions: [
        { field: 's.a', operator: 'eq', value: 'yes' },
        { field: 's.b', operator: 'eq', value: 'yes' }, // b is 'no'
      ],
      actions: [{ action: 'hide_fields', params: { fields: ['s.a'] } }],
    });
    const state = evaluateRules([r], formData);
    expect(state.hiddenFields.has('s.a')).toBe(false); // Not hidden — AND failed
  });

  it('OR: at least one condition must match', () => {
    const r = rule({
      condition_logic: 'or',
      conditions: [
        { field: 's.a', operator: 'eq', value: 'yes' }, // matches
        { field: 's.b', operator: 'eq', value: 'yes' }, // fails
      ],
      actions: [{ action: 'hide_fields', params: { fields: ['s.a'] } }],
    });
    const state = evaluateRules([r], formData);
    expect(state.hiddenFields.has('s.a')).toBe(true); // Hidden — OR succeeded
  });

  it('no conditions = always true', () => {
    const r = rule({
      conditions: [],
      actions: [{ action: 'hide_steps', params: { steps: ['s'] } }],
    });
    const state = evaluateRules([r], formData);
    expect(state.hiddenSteps.has('s')).toBe(true);
  });
});

// ─── evaluateRules: action types ────────────────────────────────────────────────

describe('evaluateRules — actions', () => {
  const formData: FormData = { s: { trigger: 'go' } };

  it('display_fields: removes from hidden set', () => {
    const vis = emptyVisibility();
    vis.hiddenFields.add('s.target');
    // Simulate by running a hide rule first, then a display rule
    const rules = [
      rule({
        id: 'r1',
        order: 0,
        conditions: [{ field: 's.trigger', operator: 'eq', value: 'go' }],
        actions: [{ action: 'hide_fields', params: { fields: ['s.target'] } }],
      }),
      rule({
        id: 'r2',
        order: 1,
        conditions: [{ field: 's.trigger', operator: 'eq', value: 'go' }],
        actions: [{ action: 'display_fields', params: { fields: ['s.target'] } }],
      }),
    ];
    const state = evaluateRules(rules, formData);
    expect(state.hiddenFields.has('s.target')).toBe(false);
  });

  it('display_steps / display_entities: removes from hidden steps', () => {
    const rules = [
      rule({
        id: 'r1',
        order: 0,
        conditions: [{ field: 's.trigger', operator: 'eq', value: 'go' }],
        actions: [{ action: 'hide_steps', params: { steps: ['step2'] } }],
      }),
      rule({
        id: 'r2',
        order: 1,
        conditions: [{ field: 's.trigger', operator: 'eq', value: 'go' }],
        actions: [{ action: 'display_entities', params: { steps: ['step2'] } }],
      }),
    ];
    const state = evaluateRules(rules, formData);
    expect(state.hiddenSteps.has('step2')).toBe(false);
  });

  it('filter_options: sets allowed options for a field', () => {
    const r = rule({
      conditions: [{ field: 's.trigger', operator: 'eq', value: 'go' }],
      actions: [{
        action: 'filter_options',
        params: { field: 'category', options: ['A', 'B'] },
      }],
    });
    const state = evaluateRules([r], formData);
    expect(state.filteredOptions.get('category')).toEqual(['A', 'B']);
  });

  it('set_value: stores value to auto-set', () => {
    const r = rule({
      conditions: [{ field: 's.trigger', operator: 'eq', value: 'go' }],
      actions: [{
        action: 'set_value',
        params: { field: 's.computed', value: 42 },
      }],
    });
    const state = evaluateRules([r], formData);
    expect(state.setValues.get('s.computed')).toBe(42);
  });

  it('actions not applied when rule does not match', () => {
    const r = rule({
      conditions: [{ field: 's.trigger', operator: 'eq', value: 'stop' }],
      actions: [{ action: 'hide_fields', params: { fields: ['s.trigger'] } }],
    });
    const state = evaluateRules([r], formData);
    expect(state.hiddenFields.size).toBe(0);
  });
});

// ─── evaluateRules: rule ordering ───────────────────────────────────────────────

describe('evaluateRules — rule ordering', () => {
  it('later rules override earlier rules', () => {
    const formData: FormData = { s: { x: 'a' } };
    const rules = [
      rule({
        id: 'r1',
        order: 0,
        conditions: [{ field: 's.x', operator: 'eq', value: 'a' }],
        actions: [{ action: 'hide_fields', params: { fields: ['s.y'] } }],
      }),
      rule({
        id: 'r2',
        order: 1,
        conditions: [{ field: 's.x', operator: 'eq', value: 'a' }],
        actions: [{ action: 'display_fields', params: { fields: ['s.y'] } }],
      }),
    ];
    const state = evaluateRules(rules, formData);
    expect(state.hiddenFields.has('s.y')).toBe(false);
  });

  it('processes rules sorted by order, not array position', () => {
    const formData: FormData = { s: { x: 'a' } };
    const rules = [
      rule({
        id: 'second',
        order: 10, // Higher order but first in array
        conditions: [{ field: 's.x', operator: 'eq', value: 'a' }],
        actions: [{ action: 'display_fields', params: { fields: ['s.y'] } }],
      }),
      rule({
        id: 'first',
        order: 1, // Lower order but second in array
        conditions: [{ field: 's.x', operator: 'eq', value: 'a' }],
        actions: [{ action: 'hide_fields', params: { fields: ['s.y'] } }],
      }),
    ];
    const state = evaluateRules(rules, formData);
    // order=1 hides, order=10 shows → final: not hidden
    expect(state.hiddenFields.has('s.y')).toBe(false);
  });
});

// ─── field resolution (cross-step lookup) ───────────────────────────────────────

describe('evaluateRules — field resolution', () => {
  it('resolves field with step prefix', () => {
    const formData: FormData = { step1: { color: 'red' }, step2: {} };
    const r = rule({
      conditions: [{ field: 'step1.color', operator: 'eq', value: 'red' }],
      actions: [{ action: 'hide_steps', params: { steps: ['step2'] } }],
    });
    const state = evaluateRules([r], formData);
    expect(state.hiddenSteps.has('step2')).toBe(true);
  });

  it('resolves field using step_id from condition', () => {
    const formData: FormData = { s1: { type: 'A' } };
    const r = rule({
      conditions: [{ step_id: 's1', field: 'type', operator: 'eq', value: 'A' }],
      actions: [{ action: 'hide_fields', params: { fields: ['s1.extra'] } }],
    });
    const state = evaluateRules([r], formData);
    expect(state.hiddenFields.has('s1.extra')).toBe(true);
  });

  it('searches all steps when no step prefix', () => {
    const formData: FormData = { s1: {}, s2: { unique_field: 'found' } };
    const r = rule({
      conditions: [{ field: 'unique_field', operator: 'eq', value: 'found' }],
      actions: [{ action: 'hide_steps', params: { steps: ['s1'] } }],
    });
    const state = evaluateRules([r], formData);
    expect(state.hiddenSteps.has('s1')).toBe(true);
  });
});

// ─── isFieldVisible ─────────────────────────────────────────────────────────────

describe('isFieldVisible', () => {
  it('returns true when field is not hidden', () => {
    const vis = emptyVisibility();
    expect(isFieldVisible('s1', 'name', vis)).toBe(true);
  });

  it('returns false when full ref is hidden', () => {
    const vis = emptyVisibility();
    vis.hiddenFields.add('s1.name');
    expect(isFieldVisible('s1', 'name', vis)).toBe(false);
  });

  it('returns false when bare field key is hidden', () => {
    const vis = emptyVisibility();
    vis.hiddenFields.add('name');
    expect(isFieldVisible('s1', 'name', vis)).toBe(false);
  });
});

// ─── isStepVisible ──────────────────────────────────────────────────────────────

describe('isStepVisible', () => {
  it('returns true when step is not hidden', () => {
    expect(isStepVisible('step1', emptyVisibility())).toBe(true);
  });

  it('returns false when step is hidden', () => {
    const vis = emptyVisibility();
    vis.hiddenSteps.add('step1');
    expect(isStepVisible('step1', vis)).toBe(false);
  });
});

// ─── getFilteredOptions ─────────────────────────────────────────────────────────

describe('getFilteredOptions', () => {
  const options = [
    { value: 'A', label: 'Alpha' },
    { value: 'B', label: 'Beta' },
    { value: 'C', label: 'Gamma' },
  ];

  it('returns all options when no filter set', () => {
    expect(getFilteredOptions('s', 'f', options, emptyVisibility())).toEqual(options);
  });

  it('filters by full ref', () => {
    const vis = emptyVisibility();
    vis.filteredOptions.set('s.f', ['A', 'C']);
    const result = getFilteredOptions('s', 'f', options, vis);
    expect(result).toHaveLength(2);
    expect(result.map(o => o.value)).toEqual(['A', 'C']);
  });

  it('filters by bare field key fallback', () => {
    const vis = emptyVisibility();
    vis.filteredOptions.set('f', ['B']);
    const result = getFilteredOptions('s', 'f', options, vis);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('B');
  });
});

// ─── getAutoSetValue ────────────────────────────────────────────────────────────

describe('getAutoSetValue', () => {
  it('returns undefined when no set_value rule matched', () => {
    expect(getAutoSetValue('s', 'f', emptyVisibility())).toBeUndefined();
  });

  it('returns value by full ref', () => {
    const vis = emptyVisibility();
    vis.setValues.set('s.f', 'auto');
    expect(getAutoSetValue('s', 'f', vis)).toBe('auto');
  });

  it('returns value by bare field key', () => {
    const vis = emptyVisibility();
    vis.setValues.set('f', 99);
    expect(getAutoSetValue('s', 'f', vis)).toBe(99);
  });

  it('prefers full ref over bare key', () => {
    const vis = emptyVisibility();
    vis.setValues.set('s.f', 'full');
    vis.setValues.set('f', 'bare');
    expect(getAutoSetValue('s', 'f', vis)).toBe('full');
  });
});

// ─── flatDataToFormData ─────────────────────────────────────────────────────────

describe('flatDataToFormData', () => {
  it('converts dotted keys to nested structure', () => {
    const flat = { 's1.name': 'Alice', 's2.age': 30 };
    const steps = [{ id: 's1' }, { id: 's2' }];
    const result = flatDataToFormData(flat, steps);
    expect(result.s1.name).toBe('Alice');
    expect(result.s2.age).toBe(30);
  });

  it('puts non-dotted keys in first step', () => {
    const flat = { color: 'red' };
    const steps = [{ id: 's1' }, { id: 's2' }];
    const result = flatDataToFormData(flat, steps);
    expect(result.s1.color).toBe('red');
  });

  it('initializes all steps even with no data', () => {
    const result = flatDataToFormData({}, [{ id: 'a' }, { id: 'b' }]);
    expect(result.a).toEqual({});
    expect(result.b).toEqual({});
  });

  it('ignores keys for non-existent steps', () => {
    const flat = { 'missing.field': 'val' };
    const steps = [{ id: 's1' }];
    const result = flatDataToFormData(flat, steps);
    expect(result.s1).toEqual({});
    // 'missing' step was not initialized so key is dropped
  });
});

// ─── getVisibleSteps ────────────────────────────────────────────────────────────

describe('getVisibleSteps', () => {
  it('returns all steps when none are hidden', () => {
    const steps = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(getVisibleSteps(steps, emptyVisibility())).toHaveLength(3);
  });

  it('filters out hidden steps', () => {
    const steps = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const vis = emptyVisibility();
    vis.hiddenSteps.add('b');
    const result = getVisibleSteps(steps, vis);
    expect(result).toHaveLength(2);
    expect(result.map(s => s.id)).toEqual(['a', 'c']);
  });
});

// ─── getVisibleFields ───────────────────────────────────────────────────────────

describe('getVisibleFields', () => {
  const fields = [
    { key: 'name' },
    { key: 'email' },
    { key: 'phone' },
  ];

  it('returns all fields when none are hidden', () => {
    expect(getVisibleFields('s1', fields, emptyVisibility())).toHaveLength(3);
  });

  it('filters out hidden fields', () => {
    const vis = emptyVisibility();
    vis.hiddenFields.add('s1.email');
    const result = getVisibleFields('s1', fields, vis);
    expect(result).toHaveLength(2);
    expect(result.map(f => f.key)).toEqual(['name', 'phone']);
  });
});
