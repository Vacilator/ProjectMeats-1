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
import { useAuth } from '@/contexts/AuthContext';
import Modal from '@/components/Modal/Modal';

interface TenantUser {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  role: 'owner' | 'admin' | 'manager' | 'user' | 'readonly';
  is_active: boolean;
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
  const canAccess =
    permissions.can_manage_users || permissions.can_invite_users || permissions.can_change_roles;

  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TenantUser | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('user');
  const [editRole, setEditRole] = useState<string>('user');

  const { data: users = [], isLoading: usersLoading } = useQuery<TenantUser[]>({
    queryKey: ['tenant-users'],
    enabled: canAccess,
    queryFn: async () => {
      const response = await apiClient.get('/tenant-users/');
      const data = response.data.results || response.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: invitations = [] } = useQuery<Invitation[]>({
    queryKey: ['tenant-invitations'],
    enabled: canAccess,
    queryFn: async () => {
      const response = await apiClient.get('/invitations/?status=pending');
      const data = response.data.results || response.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const normalizedQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const matchesUser = (row: TenantUser) => {
    if (!normalizedQuery) return true;
    const name = `${row.user.first_name || ''} ${row.user.last_name || ''}`.trim().toLowerCase();
    return (
      row.user.username.toLowerCase().includes(normalizedQuery) ||
      row.user.email.toLowerCase().includes(normalizedQuery) ||
      name.includes(normalizedQuery)
    );
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

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => apiClient.post('/invitations/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-invitations'] });
      toast.success('Invitation sent successfully');
      setShowInviteModal(false);
      setInviteEmail('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to send invitation');
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
      toast.error(error.response?.data?.detail || 'Failed to resend invitation');
    },
  });

  const columns = useMemo(
    () => [
      {
        key: 'user.username',
        label: 'User',
        sortable: true,
        render: (_: any, row: TenantUser) => (
          <div>
            <div style={{ fontWeight: 600 }}>
              {row.user.first_name && row.user.last_name
                ? `${row.user.first_name} ${row.user.last_name}`
                : row.user.username}
            </div>
            <div style={{ fontSize: '12px', color: 'rgb(var(--color-text-secondary))' }}>
              {row.user.email}
            </div>
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
          if (currentUser?.id && user.user.id === currentUser.id) {
            toast.error('You cannot deactivate yourself');
            return;
          }
          setSelectedUser(user);
          setShowDeactivateConfirm(true);
        },
        variant: 'danger' as const,
        hidden: (row: TenantUser) =>
          !permissions.can_manage_users ||
          !row.is_active ||
          (currentUser?.id ? row.user.id === currentUser.id : false),
      },
      {
        label: 'Reactivate',
        icon: '✅',
        onClick: (user: TenantUser) => reactivateMutation.mutate(user.id),
        hidden: (row: TenantUser) => !permissions.can_manage_users || row.is_active,
      },
    ],
    [permissions.can_change_roles, permissions.can_manage_users, currentUser?.id, toast]
  );

  return (
    <AdminPage
      title="Users & Invitations"
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
          <AdminSection title={`Active Users (${activeUsers.length})`}>
            <AdminTable
              columns={columns as any}
              data={activeUsers}
              actions={actions as any}
              loading={usersLoading}
              emptyState={{
                icon: '👥',
                title: 'No users',
                message: 'Invite team members to get started.',
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

          {pendingInvitations.length > 0 && (
            <AdminSection title={`Pending Invitations (${pendingInvitations.length})`}>
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
                        disabled={resendMutation.isPending}
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
            </AdminSection>
          )}
        </>
      </AdminGuard>

      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite User">
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
              {(permissions.role === 'owner' || permissions.role === 'superuser') && (
                <option value="admin">Admin</option>
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
              {(permissions.role === 'owner' || permissions.role === 'superuser') && (
                <option value="admin">Admin</option>
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
          if (currentUser?.id && selectedUser.user.id === currentUser.id) {
            toast.error('You cannot deactivate yourself');
            setShowDeactivateConfirm(false);
            return;
          }
          deactivateMutation.mutate(selectedUser.id);
        }}
        title="Deactivate User"
        message={`Deactivate ${selectedUser?.user.username}? They will lose access.`}
        confirmText="Deactivate"
        confirmVariant="danger"
      />
    </AdminPage>
  );
};

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
  min-width: 320px;
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
