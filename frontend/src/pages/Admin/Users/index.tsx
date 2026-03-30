/**
 * Users & Invitations Page
 *
 * Tenant admin management for users, invitations, and roles.
 */
import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiService';
import {
  AdminGuard,
  AdminPage,
  AdminSection,
  AdminTable,
  ConfirmDialog,
  LoadingSkeleton,
  RoleBadge,
  StatusBadge,
} from '@/components/Admin';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useHealth } from '@/hooks/useHealth';
import { useAuth } from '@/contexts/AuthContext';
import Modal from '@/components/Modal/Modal';

interface TenantUser {
  id: number;
  // Backend may return a user ID (numeric) plus flat identity fields.
  // Some older payloads may return a nested user object.
  user: number | {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  role: 'owner' | 'admin' | 'manager' | 'user' | 'readonly';
  is_active: boolean;
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  created_at: string;
  updated_at: string;
}

interface Invitation {
  id: number;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
}

const UsersPage: React.FC = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { permissions } = useAdminPermissions();
  const { data: health } = useHealth();

  const emailEnabled = Boolean(health?.features?.email_send);
  const canAccess =
    permissions.can_manage_users || permissions.can_invite_users || permissions.can_change_roles;

  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TenantUser | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('user');
  const [editRole, setEditRole] = useState<string>('user');

  const {
    data: users = [],
    isLoading: usersLoading,
    isError: usersIsError,
  } = useQuery<TenantUser[]>({
    queryKey: ['tenant-users'],
    enabled: canAccess,
    queryFn: async () => {
      const response = await apiClient.get('/tenant-users/');
      const data = response.data.results || response.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const {
    data: invitations = [],
    isLoading: invitationsLoading,
    isError: invitationsIsError,
  } = useQuery<Invitation[]>({
    queryKey: ['tenant-invitations'],
    enabled: canAccess,
    queryFn: async () => {
      const response = await apiClient.get('/invitations/', {
        params: { status: 'pending' },
      });
      const data = response.data.results || response.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const normalizedQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const getUserId = (row: TenantUser): number | undefined =>
    typeof row.user === 'number' ? row.user : row.user?.id;

  const getUsername = (row: TenantUser): string =>
    row.username ?? (typeof row.user === 'object' && row.user ? row.user.username : '');

  const getEmail = (row: TenantUser): string =>
    row.email ?? (typeof row.user === 'object' && row.user ? row.user.email : '');

  const getFirstName = (row: TenantUser): string =>
    row.first_name ?? (typeof row.user === 'object' && row.user ? row.user.first_name : '');

  const getLastName = (row: TenantUser): string =>
    row.last_name ?? (typeof row.user === 'object' && row.user ? row.user.last_name : '');

  const getDisplayName = (row: TenantUser): string => {
    const first = getFirstName(row);
    const last = getLastName(row);
    const full = `${first} ${last}`.trim();
    return full || getUsername(row) || getEmail(row) || `User ${getUserId(row) ?? ''}`.trim();
  };

  const matchesUser = (row: TenantUser) => {
    if (!normalizedQuery) return true;
    const name = getDisplayName(row).toLowerCase();
    const username = getUsername(row).toLowerCase();
    const email = getEmail(row).toLowerCase();

    return username.includes(normalizedQuery) || email.includes(normalizedQuery) || name.includes(normalizedQuery);
  };

  const matchesInvitation = (row: Invitation) => {
    if (!normalizedQuery) return true;
    return row.email.toLowerCase().includes(normalizedQuery) || (row.role || '').toLowerCase().includes(normalizedQuery);
  };

  const activeUsers = useMemo(() => users.filter((u) => u.is_active).filter(matchesUser), [users, normalizedQuery]);
  const inactiveUsers = useMemo(() => users.filter((u) => !u.is_active).filter(matchesUser), [users, normalizedQuery]);
  const pendingInvitations = useMemo(
    () => invitations.filter((inv) => inv.status === 'pending' || !inv.status).filter(matchesInvitation),
    [invitations, normalizedQuery]
  );

  const getApiErrorMessage = (error: any): string => {
    const data = error?.response?.data;

    const message =
      data?.message ||
      data?.error ||
      data?.detail ||
      error?.message ||
      'Request failed';

    const code = data?.error_code ? ` (${String(data.error_code)})` : '';
    return `${String(message)}${code}`;
  };

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => apiClient.post('/invitations/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-invitations'] });
      toast.success(emailEnabled ? 'Invitation sent successfully' : 'Invitation created (email sending is disabled)');
      setShowInviteModal(false);
      setInviteEmail('');
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error) || 'Failed to send invitation');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (data: { id: number; role: string }) =>
      apiClient.patch(`/tenant-users/${data.id}/`, { role: data.role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
      toast.success('User role updated');
      setShowEditModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update role');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: number) => apiClient.patch(`/tenant-users/${id}/`, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
      toast.success('User deactivated');
      setShowDeactivateConfirm(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to deactivate');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (id: number) => apiClient.patch(`/tenant-users/${id}/`, { is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
      toast.success('User reactivated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to reactivate');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/tenant-users/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
      toast.success('User removed');
      setShowRemoveConfirm(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || error.response?.data?.detail || 'Failed to remove user');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: number) => apiClient.post(`/invitations/${id}/revoke/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-invitations'] });
      toast.success('Invitation revoked');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to revoke invitation');
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (id: number) => apiClient.post(`/invitations/${id}/resend/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-invitations'] });
      toast.success('Invitation resent');
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error) || 'Failed to resend invitation');
    },
  });

  const columns = useMemo(
    () => [
      {
        key: 'username',
        label: 'User',
        sortable: true,
        render: (_: any, row: TenantUser) => (
          <div>
            <div style={{ fontWeight: 600 }}>{getDisplayName(row)}</div>
            <div style={{ fontSize: '12px', color: 'rgb(var(--color-text-secondary))' }}>{getEmail(row)}</div>
          </div>
        ),
      },
      {
        key: 'role',
        label: 'Role',
        sortable: true,
        render: (value: string) => <RoleBadge role={value as any} />,
      },
      {
        key: 'is_active',
        label: 'Status',
        sortable: true,
        render: (value: boolean) => <StatusBadge status={value ? 'active' : 'inactive'} />,
      },
      {
        key: 'created_at',
        label: 'Joined',
        sortable: true,
        render: (value: string) => new Date(value).toLocaleDateString(),
      },
    ],
    []
  );

  const actions = useMemo(
    () => [
      {
        label: 'Edit',
        icon: '✏️',
        onClick: (user: TenantUser) => {
          setSelectedUser(user);
          setEditRole(user.role);
          setShowEditModal(true);
        },
        hidden: () => !permissions.can_change_roles,
      },
      {
        label: 'Deactivate',
        icon: '🚫',
        onClick: (user: TenantUser) => {
          const targetUserId = getUserId(user);
          if (currentUser?.id && targetUserId && targetUserId === currentUser.id) {
            toast.error('You cannot deactivate yourself');
            return;
          }
          setSelectedUser(user);
          setShowDeactivateConfirm(true);
        },
        variant: 'danger' as const,
        hidden: (row: TenantUser) => {
          const targetUserId = getUserId(row);
          return (
            !permissions.can_manage_users ||
            !row.is_active ||
            (currentUser?.id && targetUserId ? targetUserId === currentUser.id : false)
          );
        },
      },
      {
        label: 'Reactivate',
        icon: '✅',
        onClick: (user: TenantUser) => reactivateMutation.mutate(user.id),
        hidden: (row: TenantUser) => !permissions.can_manage_users || row.is_active,
      },
      {
        label: 'Remove',
        icon: '🗑️',
        variant: 'danger' as const,
        onClick: (user: TenantUser) => {
          const targetUserId = getUserId(user);
          if (currentUser?.id && targetUserId && targetUserId === currentUser.id) {
            toast.error('You cannot remove yourself');
            return;
          }
          setSelectedUser(user);
          setShowRemoveConfirm(true);
        },
        hidden: (row: TenantUser) => {
          const targetUserId = getUserId(row);
          return (
            !permissions.can_manage_users ||
            row.role === 'owner' ||
            (currentUser?.id && targetUserId ? targetUserId === currentUser.id : false)
          );
        },
      },
    ],
    [
      permissions.can_change_roles,
      permissions.can_manage_users,
      currentUser?.id,
      reactivateMutation,
      deleteMutation,
      toast,
    ]
  );

  return (
    <AdminPage
      title="User Management"
      description="Invite users, manage roles, and control access for your tenant."
      icon="👥"
      actions={
        <>
          {permissions.can_invite_users && (
            <Button variant="primary" size="sm" onClick={() => setShowInviteModal(true)}>
              ✉️ Invite User
            </Button>
          )}
        </>
      }
      headerExtras={
        canAccess ? (
          <SearchRow>
            <SearchIcon aria-hidden="true" />
            <SearchInput
              type="text"
              value={searchQuery}
              placeholder="Search users and invitations…"
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search users and invitations"
            />
          </SearchRow>
        ) : null
      }
    >
      <AdminGuard
        feature="manage_users"
        allow={(p) => p.can_manage_users || p.can_invite_users || p.can_change_roles}
        loadingFallback={<LoadingSkeleton type="table" rows={6} columns={4} />}
      >
        <>
          {(usersIsError || invitationsIsError) && (
            <AdminSection>
              <InlineError role="alert">
                Failed to load admin user data. Please refresh and try again.
              </InlineError>
            </AdminSection>
          )}

          <AdminSection title={`Active Users (${activeUsers.length})`}>
            <AdminTable
              columns={columns as any}
              data={activeUsers}
              actions={actions as any}
              loading={usersLoading}
              emptyState={{
                icon: '👥',
                title: 'No users',
                message: permissions.can_invite_users
                  ? 'Invite team members to get started.'
                  : 'No users were returned for this tenant.',
                ...(permissions.can_invite_users
                  ? {
                      action: {
                        label: 'Invite User',
                        onClick: () => setShowInviteModal(true),
                      },
                    }
                  : {}),
              }}
            />
          </AdminSection>

          {inactiveUsers.length > 0 && (
            <AdminSection title={`Inactive Users (${inactiveUsers.length})`}>
              <AdminTable
                columns={columns as any}
                data={inactiveUsers}
                actions={actions as any}
                loading={usersLoading}
                emptyState={{
                  icon: '👥',
                  title: 'No inactive users',
                  message: 'Deactivated users will appear here.',
                }}
              />
            </AdminSection>
          )}

          <AdminSection title={`Pending Invitations (${pendingInvitations.length})`}>
            {!emailEnabled && (
              <InlineWarning role="status">
                Email sending is currently disabled for this environment. You can still create invitations, but no email
                will be delivered until email is configured.
              </InlineWarning>
            )}
            {invitationsLoading ? (
              <LoadingSkeleton type="list" rows={3} />
            ) : pendingInvitations.length === 0 ? (
              <EmptyInvites>
                <div style={{ fontWeight: 650 }}>No pending invitations</div>
                <div style={{ color: 'rgb(var(--color-text-secondary))', fontSize: 13 }}>
                  {normalizedQuery
                    ? 'Try clearing your search to see invitations.'
                    : permissions.can_invite_users
                      ? 'Invite a teammate to get started.'
                      : 'You don’t have permission to invite users.'}
                </div>
                {permissions.can_invite_users && (
                  <div>
                    <Button variant="primary" size="sm" onClick={() => setShowInviteModal(true)}>
                      ✉️ Invite User
                    </Button>
                  </div>
                )}
              </EmptyInvites>
            ) : (
              <InvitationList role="list">
                {pendingInvitations.map((inv) => (
                  <InvitationRow key={inv.id} role="listitem">
                    <div>
                      <div style={{ fontWeight: 600 }}>{inv.email}</div>
                      <MetaRow>
                        <RoleBadge role={inv.role as any} />
                        <MetaText>Expires {new Date(inv.expires_at).toLocaleDateString()}</MetaText>
                      </MetaRow>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resendMutation.mutate(inv.id)}
                        disabled={!emailEnabled || resendMutation.isPending}
                      >
                        Resend
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revokeMutation.mutate(inv.id)}
                        disabled={revokeMutation.isPending}
                      >
                        Revoke
                      </Button>
                    </div>
                  </InvitationRow>
                ))}
              </InvitationList>
            )}
          </AdminSection>
        </>
      </AdminGuard>

      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite User">
        {!emailEnabled && (
          <InlineWarning role="status">
            Email sending is disabled, so this invite will be created but no email will be delivered. Configure SendGrid
            (SENDGRID_API_KEY / DEFAULT_FROM_EMAIL) then use Resend.
          </InlineWarning>
        )}
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
          }}
        >
          <FormGroup>
            <Label htmlFor="invite-email">Email *</Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </FormGroup>
          <FormGroup>
            <Label htmlFor="invite-role">Role *</Label>
            <Select id="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="readonly">Read Only</option>
              <option value="user">User</option>
              <option value="manager">Manager</option>
              {(permissions.role === 'admin' || permissions.role === 'owner' || permissions.role === 'superuser') && (
                <option value="admin">Admin</option>
              )}
              {(permissions.role === 'owner' || permissions.role === 'superuser') && (
                <option value="owner">Owner</option>
              )}
            </Select>
          </FormGroup>
          <ButtonGroup>
            <Button variant="outline" type="button" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? 'Sending…' : 'Send Invitation'}
            </Button>
          </ButtonGroup>
        </Form>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Role">
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (selectedUser) {
              updateRoleMutation.mutate({ id: selectedUser.id, role: editRole });
            }
          }}
        >
          <FormGroup>
            <Label htmlFor="edit-role">Role *</Label>
            <Select id="edit-role" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
              <option value="readonly">Read Only</option>
              <option value="user">User</option>
              <option value="manager">Manager</option>
              {(permissions.role === 'admin' || permissions.role === 'owner' || permissions.role === 'superuser') && (
                <option value="admin">Admin</option>
              )}
              {(permissions.role === 'owner' || permissions.role === 'superuser') && (
                <option value="owner">Owner</option>
              )}
            </Select>
          </FormGroup>
          <ButtonGroup>
            <Button variant="outline" type="button" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={updateRoleMutation.isPending}>
              {updateRoleMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </ButtonGroup>
        </Form>
      </Modal>

      <ConfirmDialog
        isOpen={showDeactivateConfirm}
        onClose={() => setShowDeactivateConfirm(false)}
        onConfirm={() => {
          if (!selectedUser) return;
          const targetUserId = getUserId(selectedUser);
          if (currentUser?.id && targetUserId && targetUserId === currentUser.id) {
            toast.error('You cannot deactivate yourself');
            setShowDeactivateConfirm(false);
            return;
          }
          deactivateMutation.mutate(selectedUser.id);
        }}
        title="Deactivate User"
        message={`Deactivate ${selectedUser ? getDisplayName(selectedUser) : 'this user'}? They will lose access.`}
        confirmText="Deactivate"
        confirmVariant="danger"
      />

      <ConfirmDialog
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={() => {
          if (!selectedUser) return;
          const targetUserId = getUserId(selectedUser);
          if (currentUser?.id && targetUserId && targetUserId === currentUser.id) {
            toast.error('You cannot remove yourself');
            setShowRemoveConfirm(false);
            return;
          }
          deleteMutation.mutate(selectedUser.id);
        }}
        title="Remove User"
        message={`Remove ${selectedUser ? getDisplayName(selectedUser) : 'this user'} from this tenant?`}
        confirmText={deleteMutation.isPending ? 'Removing…' : 'Remove'}
        confirmVariant="danger"
      />
    </AdminPage>
  );
};

const InlineError = styled.div`
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  background: rgb(var(--color-error) / 0.08);
  border: 1px solid rgb(var(--color-error) / 0.25);
  color: rgb(var(--color-error));
  font-size: 14px;
`;

const InlineWarning = styled.div`
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  background: rgb(var(--color-warning) / 0.1);
  border: 1px solid rgb(var(--color-warning) / 0.35);
  color: rgb(var(--color-text-primary));
  font-size: 14px;
`;

const EmptyInvites = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
`;

const InvitationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const InvitationRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
`;

const MetaRow = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 8px;
`;

const MetaText = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  background: rgb(var(--color-surface));
  min-width: 0;
  width: 100%;

  @media (min-width: 768px) {
    min-width: 320px;
    width: auto;
  }
`;

const SearchIcon = styled(Search)`
  width: 18px;
  height: 18px;
  color: rgb(var(--color-text-secondary));
`;

const SearchInput = styled.input`
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: rgb(var(--color-text-primary));
  font-size: 14px;

  &::placeholder {
    color: rgb(var(--color-text-secondary));
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const Input = styled.input`
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 14px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));

  &:focus {
    outline: none;
    border-color: rgba(var(--color-primary), 0.8);
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.12);
  }
`;

const Select = styled.select`
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  font-size: 14px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));

  &:focus {
    outline: none;
    border-color: rgba(var(--color-primary), 0.8);
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.12);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 8px;
`;

export default UsersPage;
