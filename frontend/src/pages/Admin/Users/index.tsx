/**
 * Users & Invitations Page
 *
 * Tenant admin management for users, invitations, and roles.
 */
import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiService';
import {
  AdminPage,
  AdminSection,
  AdminTable,
  ConfirmDialog,
  RoleBadge,
  StatusBadge,
} from '@/components/Admin';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
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
  const { permissions, isLoading: permissionsLoading } = useAdminPermissions();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TenantUser | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('user');
  const [editRole, setEditRole] = useState<string>('user');

  const { data: users = [], isLoading: usersLoading } = useQuery<TenantUser[]>({
    queryKey: ['tenant-users'],
    queryFn: async () => {
      const response = await apiClient.get('/tenant-users/');
      const data = response.data.results || response.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: invitations = [] } = useQuery<Invitation[]>({
    queryKey: ['tenant-invitations'],
    queryFn: async () => {
      const response = await apiClient.get('/invitations/?status=pending');
      const data = response.data.results || response.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const activeUsers = useMemo(() => users.filter((u) => u.is_active), [users]);

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
          setSelectedUser(user);
          setShowDeactivateConfirm(true);
        },
        variant: 'danger' as const,
        hidden: (row: TenantUser) => !permissions.can_manage_users || !row.is_active,
      },
    ],
    [permissions.can_change_roles, permissions.can_manage_users]
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
    >
      {permissionsLoading ? (
        <AdminSection>
          <div>Loading…</div>
        </AdminSection>
      ) : (
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

          {invitations.length > 0 && (
            <AdminSection title={`Pending Invitations (${invitations.length})`}>
              <InvitationList role="list">
                {invitations.map((inv) => (
                  <InvitationRow key={inv.id} role="listitem">
                    <div>
                      <div style={{ fontWeight: 600 }}>{inv.email}</div>
                      <MetaRow>
                        <RoleBadge role={inv.role as any} />
                        <MetaText>
                          Expires {new Date(inv.expires_at).toLocaleDateString()}
                        </MetaText>
                      </MetaRow>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revokeMutation.mutate(inv.id)}
                      disabled={revokeMutation.isPending}
                    >
                      Revoke
                    </Button>
                  </InvitationRow>
                ))}
              </InvitationList>
            </AdminSection>
          )}
        </>
      )}

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
              {permissions.role === 'owner' && <option value="admin">Admin</option>}
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
              {permissions.role === 'owner' && <option value="admin">Admin</option>}
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
        onConfirm={() => selectedUser && deactivateMutation.mutate(selectedUser.id)}
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
