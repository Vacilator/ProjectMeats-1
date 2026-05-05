import React from 'react';
import styled from 'styled-components';
import { X } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { Joyride } from 'react-joyride';
import type { Edge, Node } from '@xyflow/react';

import { HelpModal } from '../HelpModal';
import { FlowPreviewModal } from '../Modals/FlowPreviewModal';
import { PreviewPanel } from '../panels/PreviewPanel';
import { DryRunDebuggerPanel } from '../panels/DryRunDebuggerPanel';
import type { WorkflowListItem } from '../utils/workflowPersistence';
import { WorkflowExecutionModal } from '../../FormSubmission/WorkflowExecutionModal';

const ConfirmModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(var(--color-overlay), 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease;

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const ConfirmContent = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 400px;
  padding: 24px;
  box-shadow: 0 20px 25px -5px rgba(var(--color-overlay), 0.1);
  animation: scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
`;

const ConfirmTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 8px 0;
`;

const ConfirmMessage = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 0 0 20px 0;
  line-height: 1.5;
`;

const ConfirmActions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
`;

const ConfirmButton = styled.button<{ $variant?: 'danger' | 'secondary' }>`
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  color: ${(props) =>
    props.$variant === 'danger'
      ? 'rgb(var(--color-primary-foreground))'
      : 'rgb(var(--color-text-primary))'};
  background: ${(props) =>
    props.$variant === 'danger' ? 'rgb(var(--color-error))' : 'transparent'};
  border: 1px solid
    ${(props) =>
      props.$variant === 'danger'
        ? 'rgb(var(--color-error))'
        : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: ${(props) =>
      props.$variant === 'danger'
        ? 'rgb(var(--color-danger))'
        : 'rgb(var(--color-background))'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const KeyboardShortcutsModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(var(--color-overlay), 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10002;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s ease;
`;

const KeyboardShortcutsContent = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(var(--color-overlay), 0.1);
  animation: scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
`;

const KeyboardShortcutsHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const KeyboardShortcutsTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

const KeyboardShortcutsBody = styled.div`
  padding: 24px;
`;

const ShortcutSection = styled.div`
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const ShortcutSectionTitle = styled.h4`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
`;

const ShortcutList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ShortcutItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-md);
`;

const ShortcutLabel = styled.span`
  font-size: 14px;
  color: rgb(var(--color-text-primary));
`;

const ShortcutKeys = styled.div`
  display: flex;
  gap: 4px;
`;

const ShortcutKey = styled.kbd`
  padding: 2px 8px;
  font-size: 12px;
  font-family: monospace;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  box-shadow: 0 1px 2px rgba(var(--color-overlay), 0.05);
`;

type JoyrideProps = React.ComponentProps<typeof Joyride>;

interface FlowEditorPassiveOverlaysProps {
  currentWorkflowId: string | null;
  currentWorkflowName: string;
  deleteConfirmOpen: boolean;
  edges: Edge[];
  isDeleting: boolean;
  isExecutionModalOpen: boolean;
  isFlowPreviewOpen: boolean;
  isHelpModalOpen: boolean;
  isPreviewVisible: boolean;
  nodes: Node[];
  onCloseDebugger: () => void;
  onCloseDeleteConfirm: () => void;
  onCloseExecutionModal: () => void;
  onCloseFlowPreview: () => void;
  onCloseHelpModal: () => void;
  onCloseKeyboardShortcuts: () => void;
  onClosePreview: () => void;
  onConfirmDelete: () => void;
  onTourEvent: NonNullable<JoyrideProps['onEvent']>;
  runTour: JoyrideProps['run'];
  selectedNodeForDebug: Node | null;
  showDebugger: boolean;
  showKeyboardShortcuts: boolean;
  tourOptions: JoyrideProps['options'];
  tourStepIndex: JoyrideProps['stepIndex'];
  tourSteps: JoyrideProps['steps'];
  tourStyles: JoyrideProps['styles'];
  workflowToDelete: WorkflowListItem | null;
}

export const FlowEditorPassiveOverlays: React.FC<FlowEditorPassiveOverlaysProps> = ({
  currentWorkflowId,
  currentWorkflowName,
  deleteConfirmOpen,
  edges,
  isDeleting,
  isExecutionModalOpen,
  isFlowPreviewOpen,
  isHelpModalOpen,
  isPreviewVisible,
  nodes,
  onCloseDebugger,
  onCloseDeleteConfirm,
  onCloseExecutionModal,
  onCloseFlowPreview,
  onCloseHelpModal,
  onCloseKeyboardShortcuts,
  onClosePreview,
  onConfirmDelete,
  onTourEvent,
  runTour,
  selectedNodeForDebug,
  showDebugger,
  showKeyboardShortcuts,
  tourOptions,
  tourStepIndex,
  tourSteps,
  tourStyles,
  workflowToDelete,
}) => {
  return (
    <>
      <PreviewPanel
        nodes={nodes}
        isVisible={isPreviewVisible}
        onClose={onClosePreview}
      />

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgb(var(--color-surface))',
            color: 'rgb(var(--color-text-primary))',
            border: '1px solid rgb(var(--color-border))',
          },
          success: {
            iconTheme: {
              primary: 'rgb(var(--color-success))',
              secondary: 'rgb(var(--color-text-inverse))',
            },
          },
          error: {
            iconTheme: {
              primary: 'rgb(var(--color-error))',
              secondary: 'rgb(var(--color-text-inverse))',
            },
          },
          loading: {
            iconTheme: {
              primary: 'rgb(var(--color-primary))',
              secondary: 'rgb(var(--color-text-inverse))',
            },
          },
        }}
      />

      {deleteConfirmOpen && workflowToDelete && (
        <ConfirmModal
          data-testid="floweditor-delete-confirm"
          onClick={() => !isDeleting && onCloseDeleteConfirm()}
        >
          <ConfirmContent onClick={(event) => event.stopPropagation()}>
            <ConfirmTitle>Delete Workflow?</ConfirmTitle>
            <ConfirmMessage>
              Are you sure you want to delete "<strong>{workflowToDelete.name}</strong>"?
              This action cannot be undone.
            </ConfirmMessage>
            <ConfirmActions>
              <ConfirmButton
                $variant="secondary"
                onClick={onCloseDeleteConfirm}
                disabled={isDeleting}
              >
                Cancel
              </ConfirmButton>
              <ConfirmButton
                $variant="danger"
                onClick={onConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </ConfirmButton>
            </ConfirmActions>
          </ConfirmContent>
        </ConfirmModal>
      )}

      <DryRunDebuggerPanel
        isVisible={showDebugger}
        selectedNode={selectedNodeForDebug}
        onClose={onCloseDebugger}
      />

      {showKeyboardShortcuts && (
        <KeyboardShortcutsModal
          data-testid="floweditor-keyboard-shortcuts"
          onClick={onCloseKeyboardShortcuts}
        >
          <KeyboardShortcutsContent onClick={(event) => event.stopPropagation()}>
            <KeyboardShortcutsHeader>
              <KeyboardShortcutsTitle>Keyboard Shortcuts</KeyboardShortcutsTitle>
              <button
                aria-label="Close keyboard shortcuts"
                onClick={onCloseKeyboardShortcuts}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'rgb(var(--color-text-secondary))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                }}
              >
                <X />
              </button>
            </KeyboardShortcutsHeader>
            <KeyboardShortcutsBody>
              <ShortcutSection>
                <ShortcutSectionTitle>General</ShortcutSectionTitle>
                <ShortcutList>
                  <ShortcutItem>
                    <ShortcutLabel>Show keyboard shortcuts</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>?</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                  <ShortcutItem>
                    <ShortcutLabel>Close modal</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>ESC</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                </ShortcutList>
              </ShortcutSection>

              <ShortcutSection>
                <ShortcutSectionTitle>Workflow</ShortcutSectionTitle>
                <ShortcutList>
                  <ShortcutItem>
                    <ShortcutLabel>Save workflow</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>Ctrl</ShortcutKey>
                      <ShortcutKey>S</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                  <ShortcutItem>
                    <ShortcutLabel>New workflow</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>Ctrl</ShortcutKey>
                      <ShortcutKey>N</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                </ShortcutList>
              </ShortcutSection>

              <ShortcutSection>
                <ShortcutSectionTitle>Canvas</ShortcutSectionTitle>
                <ShortcutList>
                  <ShortcutItem>
                    <ShortcutLabel>Select all nodes</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>Ctrl</ShortcutKey>
                      <ShortcutKey>A</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                  <ShortcutItem>
                    <ShortcutLabel>Delete selected nodes</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>Delete</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                  <ShortcutItem>
                    <ShortcutLabel>Undo</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>Ctrl</ShortcutKey>
                      <ShortcutKey>Z</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                  <ShortcutItem>
                    <ShortcutLabel>Redo</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>Ctrl</ShortcutKey>
                      <ShortcutKey>Y</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                  <ShortcutItem>
                    <ShortcutLabel>Fit view</ShortcutLabel>
                    <ShortcutKeys>
                      <ShortcutKey>Ctrl</ShortcutKey>
                      <ShortcutKey>0</ShortcutKey>
                    </ShortcutKeys>
                  </ShortcutItem>
                </ShortcutList>
              </ShortcutSection>
            </KeyboardShortcutsBody>
          </KeyboardShortcutsContent>
        </KeyboardShortcutsModal>
      )}

      {isExecutionModalOpen && currentWorkflowId && (
        <WorkflowExecutionModal
          isOpen={isExecutionModalOpen}
          onClose={onCloseExecutionModal}
          workflow={{
            id: currentWorkflowId,
            name: currentWorkflowName || 'Untitled Workflow',
            nodes,
            edges,
          }}
        />
      )}

      {isFlowPreviewOpen && (
        <FlowPreviewModal
          isOpen={isFlowPreviewOpen}
          onClose={onCloseFlowPreview}
        />
      )}

      {isHelpModalOpen && (
        <HelpModal
          isOpen={isHelpModalOpen}
          onClose={onCloseHelpModal}
        />
      )}

      <Joyride
        steps={tourSteps}
        run={runTour}
        stepIndex={tourStepIndex}
        onEvent={onTourEvent}
        continuous
        options={tourOptions}
        styles={tourStyles}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip tour',
        }}
      />
    </>
  );
};
