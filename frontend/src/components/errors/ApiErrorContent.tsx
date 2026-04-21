import React from 'react';
import styled from 'styled-components';

import {
  formatApiErrorMeta,
  getApiErrorPresentation,
  type ApiErrorPresentation,
} from '@/services/apiErrorPresentation';

const BlockWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Message = styled.div`
  color: rgb(var(--color-text-primary));
`;

const Meta = styled.div`
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
  line-height: 1.35;
`;

const InlineMeta = styled.span`
  color: rgb(var(--color-text-secondary));
  font-size: 12px;
`;

export interface ApiErrorContentProps {
  error: unknown;
  fallbackMessage?: string;
  includeMeta?: boolean;
  variant?: 'inline' | 'block';
}

export const ApiErrorContent: React.FC<ApiErrorContentProps> = ({
  error,
  fallbackMessage,
  includeMeta = true,
  variant = 'block',
}) => {
  const presentation: ApiErrorPresentation = getApiErrorPresentation(error, { fallbackMessage });
  const meta = includeMeta ? formatApiErrorMeta(presentation) : undefined;

  if (variant === 'inline') {
    return (
      <>
        {presentation.friendlyMessage}
        {meta ? <InlineMeta>{` (${meta})`}</InlineMeta> : null}
      </>
    );
  }

  return (
    <BlockWrap>
      <Message>{presentation.friendlyMessage}</Message>
      {meta ? <Meta>{meta}</Meta> : null}
    </BlockWrap>
  );
};
