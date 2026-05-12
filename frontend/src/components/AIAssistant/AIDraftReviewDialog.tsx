import React, { useState } from 'react';
import { Alert, Button, Modal, Typography } from 'antd';

import { AIDraftReviewContent } from './AIDraftReviewContent';
import type { AIInboxFeedbackSubmission } from '@/components/AIAssistant/AIInboxFeedbackActions';
import type { PendingReviewItem } from '@/services/aiService';

const { Paragraph } = Typography;

/**
 * Error boundary that catches render-phase crashes (e.g. React #185)
 * inside the AI Draft Review dialog and surfaces a recovery UI.
 */
class DraftReviewErrorBoundary extends React.Component<
  { children: React.ReactNode; itemId?: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      '[AIDraftReviewDialog] Render crash caught by error boundary.',
      {
        itemId: this.props.itemId,
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

type AIDraftReviewDialogProps = {
  open: boolean;
  item: PendingReviewItem | null;
  onClose: () => void;
  onResolved?: (reviewId: string) => void;
  onFeedbackSubmitted?: (reviewId: string, submission: AIInboxFeedbackSubmission) => void;
};

export const AIDraftReviewDialog: React.FC<AIDraftReviewDialogProps> = ({
  open,
  item,
  onClose,
  onResolved,
  onFeedbackSubmitted,
}) => {
  const [resolving, setResolving] = useState(false);

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
      <DraftReviewErrorBoundary itemId={item?.id}>
        <AIDraftReviewContent
          open={open}
          item={item}
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

export default AIDraftReviewDialog;
