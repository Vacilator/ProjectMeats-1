import React, { useMemo, useState } from 'react';
import { Alert, Button, Modal, Typography } from 'antd';
import isEqual from 'lodash/isEqual';

import { AIDraftReviewContent } from './AIDraftReviewContent';
import type { AIInboxFeedbackSubmission } from '@/components/AIAssistant/AIInboxFeedbackActions';
import type { PendingReviewItem } from '@/services/aiService';
import { normalizeEntityKey } from '@/components/Shared/UniversalEntityForm';
import { resolveReviewEntityType } from './AIDraftReviewContent';
import { withTenantQueryKey } from '@/utils/queryKeys';

const { Paragraph } = Typography;

/**
 * Error boundary that catches render-phase crashes (e.g. React #185)
 * inside the AI Draft Review modal and surfaces a recovery UI.
 */
class DraftReviewErrorBoundary extends React.Component<
  { children: React.ReactNode; itemId?: string; diagnostics?: Record<string, unknown> },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      '[AIDraftReviewModal] Render crash caught by error boundary.',
      {
        itemId: this.props.itemId,
        diagnostics: this.props.diagnostics,
        error,
        componentStack: info.componentStack,
      },
    );
  }

  render() {
    if (this.state.error) {
      const is185 =
        this.state.error.message?.includes('Maximum update depth') ||
        this.state.error.message?.includes('#185');
      return (
        <Alert
          type="error"
          showIcon
          message={is185 ? 'Render loop detected' : 'Something went wrong'}
          description={
            <>
              <Paragraph>
                {is185
                  ? 'A render loop (React #185) was caught before it could crash the page. This is likely caused by an unstable query key or dependency array.'
                  : `Error: ${this.state.error.message}`}
              </Paragraph>
              <Paragraph type="secondary">
                Draft item ID: {this.props.itemId ?? 'unknown'}
              </Paragraph>
              {Array.isArray(this.props.diagnostics?.queryKeys) &&
              this.props.diagnostics.queryKeys.length > 0 ? (
                <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                  Query keys: {JSON.stringify(this.props.diagnostics.queryKeys)}
                </Paragraph>
              ) : null}
              <Button
                size="small"
                onClick={() => this.setState({ error: null })}
              >
                Retry
              </Button>
            </>
          }
        />
      );
    }
    return this.props.children;
  }
}

type AIDraftReviewModalProps = {
  open: boolean;
  item: PendingReviewItem | null;
  onClose: () => void;
  onResolved?: (reviewId: string) => void;
  onFeedbackSubmitted?: (reviewId: string, submission: AIInboxFeedbackSubmission) => void;
};

function useDeepStableValue<T>(value: T): T {
  const ref = React.useRef(value);

  if (!isEqual(ref.current, value)) {
    ref.current = value;
  }

  return ref.current;
}

export { AIDraftReviewContent, resolveReviewEntityType } from './AIDraftReviewContent';

export const AIDraftReviewModal: React.FC<AIDraftReviewModalProps> = ({
  open,
  item,
  onClose,
  onResolved,
  onFeedbackSubmitted,
}) => {
  const [resolving, setResolving] = useState(false);
  const stableItem = useDeepStableValue(item);
  const stableEntityType = useMemo(() => resolveReviewEntityType(stableItem), [stableItem]);
  const stableEntityKey = useMemo(
    () => (stableEntityType ? normalizeEntityKey(stableEntityType) : ''),
    [stableEntityType],
  );
  const modalDiagnostics = useMemo(
    () => ({
      draftKey: stableItem?.id ?? null,
      entityType: stableEntityType ?? null,
      normalizedEntityKey: stableEntityKey || null,
      queryKeys: stableEntityKey
        ? [
            withTenantQueryKey('entity-form-schema', stableEntityKey),
            withTenantQueryKey('entity-form-record', stableEntityKey, 'new'),
            withTenantQueryKey('entity-form-fk-options-batch', stableEntityKey),
          ]
        : [],
    }),
    [stableEntityKey, stableEntityType, stableItem?.id],
  );

  return (
    <Modal
      open={open}
      onCancel={resolving ? undefined : onClose}
      footer={null}
      title="AI Inbox Review"
      width={1100}
      destroyOnHidden
      mask={{ closable: !resolving }}
      keyboard={!resolving}
    >
      <DraftReviewErrorBoundary itemId={stableItem?.id} diagnostics={modalDiagnostics}>
        <AIDraftReviewContent
          open={open}
          item={stableItem}
          onClose={onClose}
          onResolved={onResolved}
          onFeedbackSubmitted={onFeedbackSubmitted}
          closeOnResolved
          onResolvingChange={setResolving}
        />
      </DraftReviewErrorBoundary>
    </Modal>
  );
};

export default AIDraftReviewModal;
