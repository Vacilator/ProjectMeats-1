import { describe, expect, it } from 'vitest';

import { buildPortalHeaders, PORTAL_TOKEN_HEADER } from './portalService';

describe('portalService', () => {
  it('builds a portal token header without internal auth or tenant headers', () => {
    expect(buildPortalHeaders('  magic-link-token  ')).toEqual({
      [PORTAL_TOKEN_HEADER]: 'magic-link-token',
    });
  });
});
