/**
 * Users & Invitations Page - Phase 1B Complete Implementation
 * 
 * Features:
 * - User list with AdminTable
 * - Invite users with email/role
 * - Edit user roles
 * - Deactivate users
 * - Pending invitations with revoke
 * 
 * Created: 2026-02-09
 */
import React, { useState } from 'react';
import styled from 'styled-components';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../services/apiService';
import { AdminTable } from '../../../components/Admin/AdminTable';
import { ConfirmDialog } from '../../../components/Admin/ConfirmDialog';
import { RoleBadge } from '../../../components/Admin/RoleBadge';
import { StatusBadge } from '../../../components/Admin/StatusBadge';
import { useToast } from '../../../hooks/useToast';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import Modal from '../../../components/Modal/Modal';

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
      // Ensure we always return an array
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: invitations = [] } = useQuery<Invitation[]>({
    queryKey: ['tenant-invitations'],
    queryFn: async () => {
      const response = await apiClient.get('/invitations/?status=pending');
      const data = response.data.results || response.data;
      // Ensure we always return an array
      return Array.isArray(data) ? data : [];
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      return await apiClient.post('/invitations/', data);
    },
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
    mutationFn: async (data: { id: number; role: string }) => {
      return await apiClient.patch(`/tenant-users/${data.id}/`, { role: data.role });
    },
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
    mutationFn: async (id: number) => {
      return await apiClient.patch(`/tenant-users/${id}/`, { is_active: false });
    },
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
    mutationFn: async (id: number) => {
      return await apiClient.post(`/invitations/${id}/revoke/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-invitations'] });
      toast.success('Invitation revoked');
    },
  });

  const columns = [
    {
      key: 'user.username',
      label: 'User',
      sortable: true,
      render: (_: any, row: TenantUser) => (
        <div>
          <div style={{ fontWeight: 500 }}>
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
  ];

  const actions = [
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
  ];

  if (permissionsLoading) {
    return <PageContainer><div>Loading...</div></PageContainer>;
  }

  return (
    <PageContainer>
      <PageHeader>
        <div>
          <PageTitle>👥 Users & Invitations</PageTitle>
          <PageDescription>Manage users, roles, and permissions</PageDescription>
        </div>
        {permissions.can_invite_users && (
          <PrimaryButton onClick={() => setShowInviteModal(true)}>
            ✉️ Invite User
          </PrimaryButton>
        )}
      </PageHeader>

      <Section>
        <SectionTitle>Active Users ({users.filter(u => u.is_active).length})</SectionTitle>
        <AdminTable
          columns={columns}
          data={users.filter(u => u.is_active)}
          actions={actions}
          loading={usersLoading}
          emptyState={{
            icon: '👥',
            title: 'No users',
            message: 'Invite team members to get started.',
          }}
        />
      </Section>

      {invitations.length > 0 && (
        <Section>
          <SectionTitle>Pending Invitations ({invitations.length})</SectionTitle>
          {invitations.map((inv) => (
            <InvitationRow key={inv.id}>
              <div>
                <div style={{ fontWeight: 500 }}>{inv.email}</div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <RoleBadge role={inv.role as any} />
                  <span style={{ fontSize: '12px' }}>
                    Expires {new Date(inv.expires_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <SecondaryButton onClick={() => revokeMutation.mutate(inv.id)}>
                Revoke
              </SecondaryButton>
            </InvitationRow>
          ))}
        </Section>
      )}

      <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite User">
        <Form onSubmit={(e) => { e.preventDefault(); inviteMutation.mutate({ email: inviteEmail, role: inviteRole }); }}>
          <FormGroup>
            <Label>Email *</Label>
            <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required />
          </FormGroup>
          <FormGroup>
            <Label>Role *</Label>
            <Select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
              <option value="user">User</option>
              <option value="manager">Manager</option>
              {permissions.role === 'owner' && <option value="admin">Admin</option>}
            </Select>
          </FormGroup>
          <ButtonGroup>
            <SecondaryButton type="button" onClick={() => setShowInviteModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit">Send Invitation</PrimaryButton>
          </ButtonGroup>
        </Form>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Role">
        <Form onSubmit={(e) => { e.preventDefault(); selectedUser && updateRoleMutation.mutate({ id: selectedUser.id, role: editRole }); }}>
          <FormGroup>
            <Label>Role *</Label>
            <Select value={editRole} onChange={e => setEditRole(e.target.value)}>
              <option value="readonly">Read Only</option>
              <option value="user">User</option>
              <option value="manager">Manager</option>
              {permissions.role === 'owner' && <option value="admin">Admin</option>}
            </Select>
          </FormGroup>
          <ButtonGroup>
            <SecondaryButton type="button" onClick={() => setShowEditModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit">Save</PrimaryButton>
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
    </PageContainer>
  );
};

const PageContainer = styled.div`padding: 24px; max-width: 1400px; margin: 0 auto;`;
const PageHeader = styled.div`display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px;`;
const PageTitle = styled.h1`font-size: 28px; font-weight: 700; color: rgb(var(--color-text-primary)); margin: 0 0 8px 0;`;
const PageDescription = styled.p`font-size: 14px; color: rgb(var(--color-text-secondary)); margin: 0;`;
const Section = styled.div`margin-bottom: 32px;`;
const SectionTitle = styled.h2`font-size: 18px; font-weight: 600; margin: 0 0 16px 0;`;
const InvitationRow = styled.div`display: flex; justify-content: space-between; align-items: center; padding: 16px; background: rgb(var(--color-surface)); border: 1px solid rgb(var(--color-border)); border-radius: var(--radius-md); margin-bottom: 12px;`;
const Form = styled.form`display: flex; flex-direction: column; gap: 20px;`;
const FormGroup = styled.div`display: flex; flex-direction: column; gap: 8px;`;
const Label = styled.label`font-size: 14px; font-weight: 500;`;
const Input = styled.input`padding: 10px 12px; border: 1px solid rgb(var(--color-border)); border-radius: var(--radius-md); font-size: 14px; &:focus { outline: none; border-color: rgb(var(--color-primary)); }`;
const Select = styled.select`padding: 10px 12px; border: 1px solid rgb(var(--color-border)); border-radius: var(--radius-md); font-size: 14px;`;
const ButtonGroup = styled.div`display: flex; gap: 12px; justify-content: flex-end;`;
const Button = styled.button`padding: 10px 20px; border-radius: var(--radius-md); font-size: 14px; font-weight: 500; cursor: pointer; border: none;`;
const PrimaryButton = styled(Button)`background: rgb(var(--color-primary)); color: white;`;
const SecondaryButton = styled(Button)`background: rgb(var(--color-surface)); color: rgb(var(--color-text-primary)); border: 1px solid rgb(var(--color-border));`;

export default UsersPage;
