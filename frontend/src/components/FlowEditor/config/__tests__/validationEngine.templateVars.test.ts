import { describe, it, expect } from 'vitest';

import { validateField } from '../validationEngine';

describe('validationEngine (template variables)', () => {
  it('treats {{...}} as valid for email/url/regex validations', () => {
    const allValues = {};

    expect(
      validateField(
        { id: 'to', label: 'To', validation: [{ type: 'email', message: 'bad' }] } as any,
        '{{customer.email}}',
        allValues
      )
    ).toBeNull();

    expect(
      validateField(
        { id: 'url', label: 'URL', validation: [{ type: 'url', message: 'bad' }] } as any,
        '{{webhook.url}}',
        allValues
      )
    ).toBeNull();

    expect(
      validateField(
        { id: 'pattern', label: 'Pattern', validation: [{ type: 'regex', value: '^a$', message: 'bad' }] } as any,
        '{{value}}',
        allValues
      )
    ).toBeNull();
  });

  it('allows comma-separated email lists', () => {
    const allValues = {};

    expect(
      validateField(
        { id: 'to', label: 'To', validation: [{ type: 'email', message: 'bad' }] } as any,
        'a@example.com, b@example.com',
        allValues
      )
    ).toBeNull();

    expect(
      validateField(
        { id: 'to', label: 'To', validation: [{ type: 'email', message: 'bad' }] } as any,
        'a@example.com, not-an-email',
        allValues
      )
    ).toBe('bad');
  });
});
