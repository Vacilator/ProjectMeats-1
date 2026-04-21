// Basic type-level tests for mobile types — no native modules needed.
import {
  GuestSession,
  TenantInvite,
  InviteAcceptRequest,
  WorkForm,
  WorkFormNode,
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
      tenant: 'tenant-1',
      is_active: true,
      node_count: 5,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    };
    expect(form.is_active).toBe(true);
    expect(form.node_count).toBe(5);
    expect(form.description).toBeUndefined();
    expect(form.nodes).toBeUndefined();
  });

  it('should accept optional nodes array', () => {
    const node: WorkFormNode = {
      id: 'n-1',
      type: 'text_field',
      label: 'Name',
      position: { x: 0, y: 0 },
      data: {},
    };
    const form: WorkForm = {
      id: 'wf-2',
      name: 'Form with Nodes',
      tenant: 'tenant-1',
      is_active: true,
      node_count: 1,
      nodes: [node],
      created_at: '',
      updated_at: '',
    };
    expect(form.nodes).toHaveLength(1);
    expect(form.nodes![0].type).toBe('text_field');
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
