// Basic type-level tests for mobile types — no native modules needed.
import {
  GuestSession,
  TenantInvite,
  InviteAcceptRequest,
  WorkForm,
  RootStackParamList,
} from '../types';

describe('GuestSession type', () => {
  it('should have the required fields', () => {
    const session: GuestSession = {
      token: 'tok_guest',
      user: {
        id: 1,
        username: 'guest',
        email: '',
        first_name: 'Guest',
        last_name: '',
        is_active: true,
        date_joined: '2026-03-19T00:00:00Z',
      },
      tenant: {
        id: 'uuid-1',
        name: 'Guest Tenant',
        slug: 'guest',
        role: 'admin',
        is_guest: true,
      },
      message: 'Welcome',
    };
    expect(session.token).toBe('tok_guest');
    expect(session.tenant.is_guest).toBe(true);
  });
});

describe('TenantInvite type', () => {
  it('should have the required fields', () => {
    const invite: TenantInvite = {
      token: 'uuid-token',
      valid: true,
      email: 'user@example.com',
      role: 'user',
      is_reusable: false,
      uses_remaining: 1,
      tenant: { name: 'Test Tenant', slug: 'test-tenant' },
      message: null,
      expires_at: '2026-03-25T00:00:00Z',
    };
    expect(invite.valid).toBe(true);
    expect(invite.role).toBe('user');
  });
});

describe('InviteAcceptRequest type', () => {
  it('should require token, username, email, password', () => {
    const req: InviteAcceptRequest = {
      token: 'uuid-token',
      username: 'newuser',
      email: 'user@example.com',
      password: 'password123',
    };
    expect(req.token).toBe('uuid-token');
    expect(req.first_name).toBeUndefined();
  });

  it('should accept optional first_name and last_name', () => {
    const req: InviteAcceptRequest = {
      token: 'tok',
      username: 'u',
      email: 'e@e.com',
      password: 'p',
      first_name: 'John',
      last_name: 'Doe',
    };
    expect(req.first_name).toBe('John');
    expect(req.last_name).toBe('Doe');
  });
});

describe('WorkForm type', () => {
  it('should have the required fields', () => {
    const form: WorkForm = {
      id: 'wf-1',
      name: 'Intake Form',
      status: 'active',
      is_active: true,
      node_count: 5,
      updated_at: '2026-01-02T00:00:00Z',
    };
    expect(form.is_active).toBe(true);
    expect(form.status).toBe('active');
    expect(form.node_count).toBe(5);
    expect(form.description).toBeUndefined();
    expect(form.workflow_definition).toBeUndefined();
  });

  it('should accept optional workflow_definition on detail responses', () => {
    const form: WorkForm = {
      id: 'wf-2',
      name: 'Form with Definition',
      status: 'draft',
      is_active: false,
      node_count: 1,
      updated_at: '2026-01-02T00:00:00Z',
      workflow_definition: {
        nodes: [{ id: 'n-1' }],
        edges: [],
      },
    };

    expect(form.workflow_definition?.nodes).toHaveLength(1);
  });
});

describe('RootStackParamList type', () => {
  it('should include all required screens', () => {
    // TypeScript will fail to compile if screens are missing.
    // This test documents the expected navigation structure.
    const screens: (keyof RootStackParamList)[] = [
      'Login',
      'Guest',
      'Invite',
      'Tenants',
      'Home',
      'GuestHome',
      'WorkForms',
    ];
    expect(screens).toHaveLength(7);
    expect(screens).toContain('Guest');
    expect(screens).toContain('Invite');
    expect(screens).toContain('WorkForms');
  });
});
