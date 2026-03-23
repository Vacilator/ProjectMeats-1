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
      guest_token: 'gt_abc123',
      tenant_id: 'uuid-1',
      tenant_name: 'Test Tenant',
      tenant_slug: 'test-tenant',
      expires_at: '2026-03-19T00:00:00Z',
      permissions: ['view_workforms'],
    };
    expect(session.guest_token).toBe('gt_abc123');
    expect(session.permissions).toContain('view_workforms');
  });
});

describe('TenantInvite type', () => {
  it('should have the required fields', () => {
    const invite: TenantInvite = {
      token: 'uuid-token',
      tenant_id: 'uuid-1',
      tenant_name: 'Test Tenant',
      tenant_slug: 'test-tenant',
      invited_by: 'admin',
      invited_email: 'user@example.com',
      role: 'user',
      expires_at: '2026-03-25T00:00:00Z',
      is_expired: false,
      is_accepted: false,
    };
    expect(invite.is_expired).toBe(false);
    expect(invite.role).toBe('user');
  });

  it('should accept all valid role values', () => {
    const roles: TenantInvite['role'][] = ['admin', 'manager', 'user', 'readonly'];
    roles.forEach((role) => {
      const invite: TenantInvite = {
        token: 'tok',
        tenant_id: '1',
        tenant_name: 'T',
        tenant_slug: 't',
        invited_by: 'a',
        invited_email: 'e@e.com',
        role,
        expires_at: '',
        is_expired: false,
        is_accepted: false,
      };
      expect(invite.role).toBe(role);
    });
  });
});

describe('InviteAcceptRequest type', () => {
  it('should require token, username, password', () => {
    const req: InviteAcceptRequest = {
      token: 'uuid-token',
      username: 'newuser',
      password: 'password123',
    };
    expect(req.token).toBe('uuid-token');
    expect(req.first_name).toBeUndefined();
  });

  it('should accept optional first_name and last_name', () => {
    const req: InviteAcceptRequest = {
      token: 'tok',
      username: 'u',
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
