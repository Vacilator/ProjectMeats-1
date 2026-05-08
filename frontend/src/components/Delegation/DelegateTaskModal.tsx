/**
 * DelegateTaskModal Component
 * 
 * Modal for delegating a task/form step to another user.
 * Allows selecting a delegate, setting due date, and adding notes.
 */
import React, { useEffect, useState } from 'react';
import { z } from 'zod';

import { useZodForm } from '@/hooks/useZodForm';
import styled, { keyframes } from 'styled-components';
import { logger } from '@/utils/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  department?: string;
}

export interface DelegationData {
  delegateUserId: string;
  delegateUser: User;
  reason: string;
  dueDate?: string;
  notifyOriginalAssignee: boolean;
  retainAccess: boolean;
}

export interface DelegateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelegate: (data: DelegationData) => Promise<void>;
  taskName: string;
  currentAssignee?: User;
  availableUsers: User[];
  isLoading?: boolean;
}

// ============================================================================
// FORM (RHF + Zod)
// ============================================================================

const delegateTaskFormSchema = z.object({
  delegateUserId: z.string().trim().min(1, 'Delegate is required'),
  reason: z.string().optional().default(''),
  dueDate: z.string().optional().default(''),
  notifyOriginalAssignee: z.coerce.boolean().default(true),
  retainAccess: z.coerce.boolean().default(false),
});

type DelegateTaskFormValues = z.infer<typeof delegateTaskFormSchema>;

const delegateTaskFormDefaults: DelegateTaskFormValues = {
  delegateUserId: '',
  reason: '',
  dueDate: '',
  notifyOriginalAssignee: true,
  retainAccess: false,
};

// ============================================================================
// ANIMATIONS
// ============================================================================

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Overlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${props => props.$isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: ${fadeIn} 0.2s ease;
`;

const Modal = styled.div`
  background: rgb(var(--color-surface, 255 255 255));
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-float);
  animation: ${slideUp} 0.3s ease;
`;

const Header = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border, 224 224 224));
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary, 44 62 80));
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  
  &:hover {
    color: rgb(var(--color-text-primary, 44 62 80));
  }
`;

const Body = styled.div`
  padding: 24px;
`;

const TaskInfo = styled.div`
  background: rgb(var(--color-background, 248 249 250));
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 20px;
`;

const TaskLabel = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  display: block;
  margin-bottom: 4px;
`;

const TaskName = styled.span`
  font-size: 15px;
  font-weight: 500;
  color: rgb(var(--color-text-primary, 44 62 80));
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary, 44 62 80));
  margin-bottom: 8px;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border, 224 224 224));
  border-radius: 8px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const UserList = styled.div`
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid rgb(var(--color-border, 224 224 224));
  border-radius: 8px;
  margin-top: 8px;
`;

const UserOption = styled.div<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  cursor: pointer;
  transition: background 0.15s ease;
  background: ${props => props.$selected
    ? 'rgba(var(--color-primary), 0.1)'
    : 'transparent'};
  border-bottom: 1px solid rgb(var(--color-border, 224 224 224));
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background: ${props => props.$selected
      ? 'rgba(var(--color-primary), 0.15)'
      : 'rgb(var(--color-background, 248 249 250))'};
  }
`;

const UserAvatar = styled.div<{ $hasImage: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${props => props.$hasImage ? 'transparent' : 'rgb(var(--color-primary, 102 126 234))'};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const UserInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const UserName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary, 44 62 80));
`;

const UserMeta = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary, 127 140 141));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SelectedBadge = styled.span`
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgb(var(--color-primary, 102 126 234));
  color: white;
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border, 224 224 224));
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const DateInput = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgb(var(--color-border, 224 224 224));
  border-radius: 8px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: rgb(var(--color-primary, 102 126 234));
    box-shadow: 0 0 0 3px rgba(var(--color-primary), 0.1);
  }
`;

const CheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  
  input {
    margin-top: 2px;
  }
`;

const CheckboxText = styled.div`
  flex: 1;
`;

const CheckboxTitle = styled.span`
  font-size: 14px;
  color: rgb(var(--color-text-primary, 44 62 80));
  display: block;
`;

const CheckboxHint = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-secondary, 127 140 141));
`;

const Footer = styled.div`
  padding: 16px 24px;
  border-top: 1px solid rgb(var(--color-border, 224 224 224));
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const Button = styled.button<{ $variant: 'primary' | 'secondary' }>`
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  
  ${props => props.$variant === 'primary' ? `
    background: rgb(var(--color-primary, 102 126 234));
    color: white;
    border: none;
    
    &:hover:not(:disabled) { opacity: 0.9; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  ` : `
    background: rgb(var(--color-background, 248 249 250));
    color: rgb(var(--color-text-primary, 44 62 80));
    border: 1px solid rgb(var(--color-border, 224 224 224));
    
    &:hover { background: rgb(var(--color-border, 224 224 224)); }
  `}
`;

const NoResults = styled.div`
  padding: 20px;
  text-align: center;
  color: rgb(var(--color-text-secondary, 127 140 141));
  font-size: 14px;
`;

const ErrorMessage = styled.div`
  color: rgb(var(--color-error));
  font-size: 0.875rem;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: rgba(220, 38, 38, 0.1);
  border-radius: var(--radius-md);
`;

const FieldError = styled.div`
  color: rgb(var(--color-error));
  font-size: 0.875rem;
  margin-top: 0.5rem;
`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// ============================================================================
// COMPONENT
// ============================================================================

export const DelegateTaskModal: React.FC<DelegateTaskModalProps> = ({
  isOpen,
  onClose,
  onDelegate,
  taskName,
  currentAssignee,
  availableUsers,
  isLoading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useZodForm<DelegateTaskFormValues>(delegateTaskFormSchema, {
    defaultValues: delegateTaskFormDefaults,
  });

  // Filter users based on search
  const filteredUsers = availableUsers.filter(user => {
    if (currentAssignee && user.id === currentAssignee.id) return false;
    const query = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      (user.role && user.role.toLowerCase().includes(query)) ||
      (user.department && user.department.toLowerCase().includes(query))
    );
  });

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedUserId('');
      setSubmitError(null);
      form.reset(delegateTaskFormDefaults);
    }
  }, [form, isOpen]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const delegateUser = availableUsers.find(user => user.id === values.delegateUserId);
    if (!delegateUser) {
      form.setError('delegateUserId', {
        type: 'manual',
        message: 'Selected user is no longer available',
      });
      return;
    }

    setSubmitError(null);

    try {
      await onDelegate({
        delegateUserId: delegateUser.id,
        delegateUser,
        reason: values.reason,
        dueDate: values.dueDate || undefined,
        notifyOriginalAssignee: values.notifyOriginalAssignee,
        retainAccess: values.retainAccess,
      });
      onClose();
    } catch (error) {
      logger.error('Delegation failed:', error);
      setSubmitError('Delegation failed. Please try again.');
    }
  });

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Overlay $isOpen={isOpen} onClick={handleOverlayClick}>
      <Modal role="dialog" aria-labelledby="delegate-modal-title">
        <Header>
          <Title id="delegate-modal-title">Delegate Task</Title>
          <CloseButton onClick={onClose} aria-label="Close modal">×</CloseButton>
        </Header>
        
        <form onSubmit={handleSubmit}>
          <Body>
            <TaskInfo>
              <TaskLabel>Task to delegate</TaskLabel>
              <TaskName>{taskName}</TaskName>
            </TaskInfo>

            {submitError && <ErrorMessage role="alert">{submitError}</ErrorMessage>}

            <FormGroup>
              <Label htmlFor="delegate-search">Select delegate *</Label>
              <input type="hidden" {...form.register('delegateUserId')} />
              <SearchInput
                id="delegate-search"
                type="text"
                placeholder="Search by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <UserList>
                {filteredUsers.length === 0 ? (
                  <NoResults>
                    {searchQuery ? 'No users found matching your search' : 'No available users'}
                  </NoResults>
                ) : (
                  filteredUsers.map(user => (
                    <UserOption
                      key={user.id}
                      $selected={selectedUserId === user.id}
                      onClick={() => {
                        setSubmitError(null);
                        setSelectedUserId(user.id);
                        form.setValue('delegateUserId', user.id, { shouldValidate: true, shouldDirty: true });
                      }}
                      role="option"
                      aria-selected={selectedUserId === user.id}
                    >
                      <UserAvatar $hasImage={!!user.avatar}>
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} />
                        ) : (
                          getInitials(user.name)
                        )}
                      </UserAvatar>
                      <UserInfo>
                        <UserName>{user.name}</UserName>
                        <UserMeta>
                          {user.email}
                          {user.role && ` • ${user.role}`}
                          {user.department && ` • ${user.department}`}
                        </UserMeta>
                      </UserInfo>
                      {selectedUserId === user.id && (
                        <SelectedBadge>Selected</SelectedBadge>
                      )}
                    </UserOption>
                  ))
                )}
              </UserList>
              {form.formState.errors.delegateUserId?.message && (
                <FieldError role="alert">{String(form.formState.errors.delegateUserId.message)}</FieldError>
              )}
            </FormGroup>

            <FormGroup>
              <Label htmlFor="delegate-reason">Reason for delegation</Label>
              <TextArea
                id="delegate-reason"
                placeholder="Optional: Explain why you're delegating this task..."
                {...form.register('reason')}
              />
            </FormGroup>

            <FormGroup>
              <Label htmlFor="delegate-due">New due date</Label>
              <DateInput
                id="delegate-due"
                type="date"
                min={new Date().toISOString().split('T')[0]}
                {...form.register('dueDate')}
              />
            </FormGroup>

            <FormGroup>
              <CheckboxGroup>
                <CheckboxLabel>
                  <input type="checkbox" {...form.register('notifyOriginalAssignee')} />
                  <CheckboxText>
                    <CheckboxTitle>Notify original assignee</CheckboxTitle>
                    <CheckboxHint>Send notification when task is delegated and completed</CheckboxHint>
                  </CheckboxText>
                </CheckboxLabel>

                <CheckboxLabel>
                  <input type="checkbox" {...form.register('retainAccess')} />
                  <CheckboxText>
                    <CheckboxTitle>Retain view access</CheckboxTitle>
                    <CheckboxHint>Original assignee can still view task progress</CheckboxHint>
                  </CheckboxText>
                </CheckboxLabel>
              </CheckboxGroup>
            </FormGroup>
          </Body>

          <Footer>
            <Button
              $variant="secondary"
              type="button"
              onClick={onClose}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              $variant="primary"
              type="button"
              onClick={handleSubmit}
              disabled={!selectedUserId || form.formState.isSubmitting || isLoading}
            >
              {form.formState.isSubmitting ? 'Delegating...' : 'Delegate Task'}
            </Button>
          </Footer>
        </form>
      </Modal>
    </Overlay>
  );
};

export default DelegateTaskModal;
