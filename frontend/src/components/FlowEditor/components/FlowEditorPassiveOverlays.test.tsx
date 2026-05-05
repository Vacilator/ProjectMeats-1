import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from '@xyflow/react';

import { FlowEditorPassiveOverlays } from './FlowEditorPassiveOverlays';
import type { WorkflowListItem } from '../utils/workflowPersistence';

vi.mock('react-hot-toast', () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

vi.mock('react-joyride', () => ({
  Joyride: ({ run, stepIndex, steps }: { run: boolean; stepIndex?: number; steps?: unknown[] }) => (
    <div
      data-testid="joyride"
      data-run={String(run)}
      data-step-index={stepIndex ?? -1}
      data-step-count={steps?.length ?? 0}
    />
  ),
}));

vi.mock('../panels/PreviewPanel', () => ({
  PreviewPanel: ({
    isVisible,
    onClose,
  }: {
    isVisible: boolean;
    onClose: () => void;
  }) => (
    <button data-testid="preview-panel" data-visible={String(isVisible)} onClick={onClose} />
  ),
}));

vi.mock('../panels/DryRunDebuggerPanel', () => ({
  DryRunDebuggerPanel: ({
    isVisible,
    onClose,
  }: {
    isVisible: boolean;
    onClose: () => void;
  }) => (
    <button data-testid="debugger-panel" data-visible={String(isVisible)} onClick={onClose} />
  ),
}));

vi.mock('../../FormSubmission/WorkflowExecutionModal', () => ({
  WorkflowExecutionModal: ({
    isOpen,
    workflow,
  }: {
    isOpen: boolean;
    workflow: { id: string; name: string };
  }) => (
    <div
      data-testid="workflow-execution-modal"
      data-open={String(isOpen)}
      data-workflow-id={workflow.id}
      data-workflow-name={workflow.name}
    />
  ),
}));

vi.mock('../Modals/FlowPreviewModal', () => ({
  FlowPreviewModal: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="flow-preview-modal" data-open={String(isOpen)} />
  ),
}));

vi.mock('../HelpModal', () => ({
  HelpModal: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="help-modal" data-open={String(isOpen)} />
  ),
}));

const workflowToDelete: WorkflowListItem = {
  id: 'workflow-1',
  name: 'Outbound Trade Flow',
  description: 'Demo workflow',
  status: 'draft',
  node_count: 3,
  edge_count: 2,
  updated_at: '2026-05-05T00:00:00Z',
};

const nodes: Node[] = [];
const edges: Edge[] = [];

const renderComponent = (overrides: Partial<React.ComponentProps<typeof FlowEditorPassiveOverlays>> = {}) => {
  return render(
    <FlowEditorPassiveOverlays
      currentWorkflowId={null}
      currentWorkflowName=""
      deleteConfirmOpen={false}
      edges={edges}
      isDeleting={false}
      isExecutionModalOpen={false}
      isFlowPreviewOpen={false}
      isHelpModalOpen={false}
      isPreviewVisible={false}
      nodes={nodes}
      onCloseDebugger={vi.fn()}
      onCloseDeleteConfirm={vi.fn()}
      onCloseExecutionModal={vi.fn()}
      onCloseFlowPreview={vi.fn()}
      onCloseHelpModal={vi.fn()}
      onCloseKeyboardShortcuts={vi.fn()}
      onClosePreview={vi.fn()}
      onConfirmDelete={vi.fn()}
      onTourEvent={vi.fn()}
      runTour={false}
      selectedNodeForDebug={null}
      showDebugger={false}
      showKeyboardShortcuts={false}
      tourOptions={{}}
      tourStepIndex={0}
      tourSteps={[]}
      tourStyles={{}}
      workflowToDelete={null}
      {...overrides}
    />
  );
};

describe('FlowEditorPassiveOverlays', () => {
  it('renders always-on passive hosts while keeping conditional overlays unmounted', () => {
    renderComponent();

    expect(screen.getByTestId('preview-panel')).toHaveAttribute('data-visible', 'false');
    expect(screen.getByTestId('debugger-panel')).toHaveAttribute('data-visible', 'false');
    expect(screen.getByTestId('toaster')).toBeInTheDocument();
    expect(screen.getByTestId('joyride')).toHaveAttribute('data-run', 'false');
    expect(screen.queryByTestId('floweditor-delete-confirm')).not.toBeInTheDocument();
    expect(screen.queryByTestId('floweditor-keyboard-shortcuts')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workflow-execution-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('flow-preview-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('help-modal')).not.toBeInTheDocument();
  });

  it('wires delete confirmation and keyboard shortcut close handlers', () => {
    const onCloseDeleteConfirm = vi.fn();
    const onConfirmDelete = vi.fn();
    const onCloseKeyboardShortcuts = vi.fn();

    renderComponent({
      deleteConfirmOpen: true,
      onCloseDeleteConfirm,
      onConfirmDelete,
      onCloseKeyboardShortcuts,
      showKeyboardShortcuts: true,
      workflowToDelete,
    });

    expect(screen.getByText('Delete Workflow?')).toBeInTheDocument();
    expect(screen.getByText(/Outbound Trade Flow/)).toBeInTheDocument();
    expect(screen.getByTestId('floweditor-keyboard-shortcuts')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByLabelText('Close keyboard shortcuts'));

    expect(onCloseDeleteConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirmDelete).toHaveBeenCalledTimes(1);
    expect(onCloseKeyboardShortcuts).toHaveBeenCalledTimes(1);
  });

  it('renders execution, help, and flow preview overlays only when enabled and keyed data exists', () => {
    const { rerender } = renderComponent({
      currentWorkflowId: 'wf-123',
      currentWorkflowName: '',
      isExecutionModalOpen: true,
      isFlowPreviewOpen: true,
      isHelpModalOpen: true,
      runTour: true,
      tourStepIndex: 2,
      tourSteps: [{ target: 'body', content: 'Hello' }],
    });

    expect(screen.getByTestId('workflow-execution-modal')).toHaveAttribute(
      'data-workflow-name',
      'Untitled Workflow'
    );
    expect(screen.getByTestId('flow-preview-modal')).toBeInTheDocument();
    expect(screen.getByTestId('help-modal')).toBeInTheDocument();
    expect(screen.getByTestId('joyride')).toHaveAttribute('data-run', 'true');
    expect(screen.getByTestId('joyride')).toHaveAttribute('data-step-count', '1');

    rerender(
      <FlowEditorPassiveOverlays
        currentWorkflowId={null}
        currentWorkflowName=""
        deleteConfirmOpen={false}
        edges={edges}
        isDeleting={false}
        isExecutionModalOpen={true}
        isFlowPreviewOpen={false}
        isHelpModalOpen={false}
        isPreviewVisible={false}
        nodes={nodes}
        onCloseDebugger={vi.fn()}
        onCloseDeleteConfirm={vi.fn()}
        onCloseExecutionModal={vi.fn()}
        onCloseFlowPreview={vi.fn()}
        onCloseHelpModal={vi.fn()}
        onCloseKeyboardShortcuts={vi.fn()}
        onClosePreview={vi.fn()}
        onConfirmDelete={vi.fn()}
        onTourEvent={vi.fn()}
        runTour={false}
        selectedNodeForDebug={null}
        showDebugger={false}
        showKeyboardShortcuts={false}
        tourOptions={{}}
        tourStepIndex={0}
        tourSteps={[]}
        tourStyles={{}}
        workflowToDelete={null}
      />
    );

    expect(screen.queryByTestId('workflow-execution-modal')).not.toBeInTheDocument();
  });
});
