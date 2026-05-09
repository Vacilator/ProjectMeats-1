/**
 * Quick Actions Editor Modal
 *
 * Allows users to customize their Quick Actions menu by
 * adding, removing, and reordering forms.
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useQuickActions } from '../../contexts/QuickActionsContext';
import { QuickActionItem, AvailableForm } from '../../services/quickActionsService';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../config/theme';
import { Icon } from '../ui';
import { logger } from '../../utils/logger';

interface QuickActionsEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

const QuickActionsEditor: React.FC<QuickActionsEditorProps> = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const {
    quickActions,
    availableForms,
    updateQuickActions,
    refreshQuickActions,
  } = useQuickActions();

  const [localActions, setLocalActions] = useState<QuickActionItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setLocalActions([...quickActions]);
    setError(null);

    // Fetch once per open; do not depend on quickActions to avoid refresh loops.
    void refreshQuickActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, refreshQuickActions]);

  useEffect(() => {
    if (!isOpen) return;
    // Keep local list in sync with global state while open, without triggering a refetch.
    setLocalActions([...quickActions]);
  }, [isOpen, quickActions]);

  if (!isOpen) return null;

  const handleAddForm = (item: AvailableForm) => {
    const itemType = item.type === 'workflow' ? 'workflow' : 'form';

    const alreadyAdded = itemType === 'workflow'
      ? localActions.some(a => a.type === 'workflow' && a.workflow_id === item.id)
      : localActions.some(a => a.type === 'form' && a.form_id === item.id);

    if (alreadyAdded) return;

    const newAction: QuickActionItem = {
      id: `qa_${Date.now()}`,
      type: itemType,
      ...(itemType === 'workflow' ? { workflow_id: item.id } : { form_id: item.id }),
      label: item.name,
      icon: item.icon || (itemType === 'workflow' ? 'layers' : 'file-text'),
      order: localActions.length,
    };

    setLocalActions([...localActions, newAction]);
  };

  const handleRemove = (actionId: string) => {
    setLocalActions(localActions.filter(a => a.id !== actionId));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newActions = [...localActions];
    [newActions[index - 1], newActions[index]] = [newActions[index], newActions[index - 1]];
    setLocalActions(newActions.map((a, i) => ({ ...a, order: i })));
  };

  const handleMoveDown = (index: number) => {
    if (index === localActions.length - 1) return;
    const newActions = [...localActions];
    [newActions[index], newActions[index + 1]] = [newActions[index + 1], newActions[index]];
    setLocalActions(newActions.map((a, i) => ({ ...a, order: i })));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      logger.debug('Saving actions', { component: 'QuickActionsEditor', metadata: { count: localActions.length } });
      await updateQuickActions(localActions);
      await refreshQuickActions();
      onClose();
    } catch (err: any) {
      logger.error('Save failed', { component: 'QuickActionsEditor' }, err);
      // Extract detailed error from response
      const errorMsg = err?.response?.data?.error ||
                       err?.response?.data?.details ||
                       err?.message ||
                       'Failed to save quick actions';
      const errorDetails = typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg;
      setError(errorDetails);
    } finally {
      setIsSaving(false);
    }
  };

  const availableToAdd = availableForms.filter((item) => {
    const itemType = item.type === 'workflow' ? 'workflow' : 'form';
    return itemType === 'workflow'
      ? !localActions.some(a => a.type === 'workflow' && a.workflow_id === item.id)
      : !localActions.some(a => a.type === 'form' && a.form_id === item.id);
  });

  return (
    <Overlay onClick={onClose}>
      <Modal $theme={theme} onClick={(e) => e.stopPropagation()}>
        <ModalHeader $theme={theme}>
          <h2>⚡ Edit Quick Actions</h2>
          <CloseButton $theme={theme} onClick={onClose}>✕</CloseButton>
        </ModalHeader>

        <ModalBody $theme={theme}>
          {error && <ErrorMessage>{error}</ErrorMessage>}

          <Section>
            <SectionTitle $theme={theme}>Your Quick Actions</SectionTitle>
            <ActionsList $theme={theme}>
              {localActions.length === 0 ? (
                <EmptyMessage $theme={theme}>
                  No quick actions yet. Add forms from below.
                </EmptyMessage>
              ) : (
                localActions.map((action, index) => (
                  <ActionItem key={action.id} $theme={theme}>
                    <ActionIconWrapper>
                      <Icon name={action.icon} size={20} />
                    </ActionIconWrapper>
                    <ActionLabel>{action.label}</ActionLabel>
                    <ActionControls>
                      <ControlButton
                        $theme={theme}
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        title="Move up"
                      >
                        ↑
                      </ControlButton>
                      <ControlButton
                        $theme={theme}
                        onClick={() => handleMoveDown(index)}
                        disabled={index === localActions.length - 1}
                        title="Move down"
                      >
                        ↓
                      </ControlButton>
                      <RemoveButton
                        $theme={theme}
                        onClick={() => handleRemove(action.id)}
                        title="Remove"
                      >
                        ✕
                      </RemoveButton>
                    </ActionControls>
                  </ActionItem>
                ))
              )}
            </ActionsList>
          </Section>

          <Section>
            <SectionTitle $theme={theme}>Available Workforms & Forms</SectionTitle>
            <AvailableList $theme={theme}>
              {availableForms.length === 0 ? (
                <EmptyMessage $theme={theme}>
                  No active forms or workforms available for Quick Actions. Publish a form or workform first.
                </EmptyMessage>
              ) : availableToAdd.length === 0 ? (
                <EmptyMessage $theme={theme}>
                  All available items have been added.
                </EmptyMessage>
              ) : (
                availableToAdd.map((item) => {
                  const itemType = item.type === 'workflow' ? 'workflow' : 'form';
                  const count = itemType === 'workflow'
                    ? (item.node_count ?? item.step_count ?? 0)
                    : (item.step_count ?? 0);
                  const noun = itemType === 'workflow' ? 'node' : 'step';

                  return (
                    <AvailableItem
                      key={`${itemType}:${item.id}`}
                      $theme={theme}
                      onClick={() => handleAddForm(item)}
                    >
                      <ActionIconWrapper>
                        <Icon
                          name={item.icon || (itemType === 'workflow' ? 'layers' : 'file-text')}
                          size={20}
                        />
                      </ActionIconWrapper>
                      <FormInfo>
                        <FormName>{item.name}</FormName>
                        <FormMeta>
                          {count} {noun}{count !== 1 ? 's' : ''}
                        </FormMeta>
                      </FormInfo>
                      <AddButton $theme={theme}>+ Add</AddButton>
                    </AvailableItem>
                  );
                })
              )}
            </AvailableList>
          </Section>
        </ModalBody>

        <ModalFooter $theme={theme}>
          <CancelButton $theme={theme} onClick={onClose} disabled={isSaving}>
            Cancel
          </CancelButton>
          <SaveButton $theme={theme} onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : '💾 Save Changes'}
          </SaveButton>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

// Styled Components
const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Modal = styled.div<{ $theme: Theme }>`
  background: ${({ $theme }) => $theme.colors.surface};
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
`;

const ModalHeader = styled.div<{ $theme: Theme }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid ${({ $theme }) => $theme.colors.border};

  h2 {
    margin: 0;
    font-size: 18px;
    color: ${({ $theme }) => $theme.colors.textPrimary};
  }
`;

const CloseButton = styled.button<{ $theme: Theme }>`
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: ${({ $theme }) => $theme.colors.textSecondary};
  padding: 4px 8px;
  border-radius: 4px;

  &:hover {
    background: ${({ $theme }) => $theme.colors.surfaceHover};
  }
`;

const ModalBody = styled.div<{ $theme: Theme }>`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const Section = styled.div`
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3<{ $theme: Theme }>`
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: ${({ $theme }) => $theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ActionsList = styled.div<{ $theme: Theme }>`
  border: 1px solid ${({ $theme }) => $theme.colors.border};
  border-radius: 8px;
  overflow: hidden;
`;

const ActionItem = styled.div<{ $theme: Theme }>`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid ${({ $theme }) => $theme.colors.border};
  background: ${({ $theme }) => $theme.colors.surface};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${({ $theme }) => $theme.colors.surfaceHover};
  }
`;

const ActionIconWrapper = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: 12px;
  color: inherit;
`;

const ActionLabel = styled.span`
  flex: 1;
  font-weight: 500;
`;

const ActionControls = styled.div`
  display: flex;
  gap: 4px;
`;

const ControlButton = styled.button<{ $theme: Theme }>`
  background: ${({ $theme }) => $theme.colors.surfaceHover};
  border: 1px solid ${({ $theme }) => $theme.colors.border};
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  color: ${({ $theme }) => $theme.colors.textPrimary};

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background: ${({ $theme }) => $theme.colors.border};
  }
`;

const RemoveButton = styled(ControlButton)`
  color: rgb(var(--color-error));

  &:not(:disabled):hover {
    background: rgba(220, 53, 69, 0.1);
  }
`;

const AvailableList = styled.div<{ $theme: Theme }>`
  border: 1px solid ${({ $theme }) => $theme.colors.border};
  border-radius: 8px;
  max-height: 200px;
  overflow-y: auto;
`;

const AvailableItem = styled.div<{ $theme: Theme }>`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid ${({ $theme }) => $theme.colors.border};
  cursor: pointer;
  background: ${({ $theme }) => $theme.colors.surface};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${({ $theme }) => $theme.colors.surfaceHover};
  }
`;

const FormInfo = styled.div`
  flex: 1;
`;

const FormName = styled.div`
  font-weight: 500;
`;

const FormMeta = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const AddButton = styled.button<{ $theme: Theme }>`
  background: ${({ $theme }) => $theme.colors.primary};
  color: rgb(var(--color-text-inverse));
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;

  &:hover {
    opacity: 0.9;
  }
`;

const EmptyMessage = styled.div<{ $theme: Theme }>`
  padding: 24px;
  text-align: center;
  color: ${({ $theme }) => $theme.colors.textSecondary};
  font-style: italic;
`;

const ErrorMessage = styled.div`
  background: rgba(220, 53, 69, 0.1);
  border: 1px solid rgb(var(--color-error));
  color: rgb(var(--color-error));
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
`;

const ModalFooter = styled.div<{ $theme: Theme }>`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid ${({ $theme }) => $theme.colors.border};
`;

const CancelButton = styled.button<{ $theme: Theme }>`
  background: ${({ $theme }) => $theme.colors.surfaceHover};
  color: ${({ $theme }) => $theme.colors.textPrimary};
  border: 1px solid ${({ $theme }) => $theme.colors.border};
  border-radius: 6px;
  padding: 10px 20px;
  font-size: 14px;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background: ${({ $theme }) => $theme.colors.border};
  }
`;

const SaveButton = styled.button<{ $theme: Theme }>`
  background: ${({ $theme }) => $theme.colors.primary};
  color: rgb(var(--color-text-inverse));
  border: none;
  border-radius: 6px;
  padding: 10px 20px;
  font-size: 14px;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    opacity: 0.9;
  }
`;

export default QuickActionsEditor;
