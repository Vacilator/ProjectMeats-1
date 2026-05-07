import React from 'react';
import styled from 'styled-components';

import type { WorkFormExecution } from '@/services/workformExecutionService';
import { buildExecutionStory } from './executionStory';

function formatTs(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toISOString().replace('.000Z', 'Z');
}

function variantStyles(variant: string): { border: string; background: string; color: string } {
  switch (variant) {
    case 'error':
      return {
        border: 'rgb(var(--color-error))',
        background: 'rgb(var(--color-error) / 0.08)',
        color: 'rgb(var(--color-error))',
      };
    case 'success':
      return {
        border: 'rgb(var(--color-success))',
        background: 'rgb(var(--color-success) / 0.10)',
        color: 'rgb(var(--color-success))',
      };
    case 'warning':
      return {
        border: 'rgb(var(--color-warning))',
        background: 'rgb(var(--color-warning) / 0.10)',
        color: 'rgb(var(--color-warning))',
      };
    case 'info':
      return {
        border: 'rgb(var(--color-info))',
        background: 'rgb(var(--color-info) / 0.10)',
        color: 'rgb(var(--color-info))',
      };
    default:
      return {
        border: 'rgb(var(--color-border))',
        background: 'rgb(var(--color-surface))',
        color: 'rgb(var(--color-text-secondary))',
      };
  }
}

export const ExecutionStoryView: React.FC<{ execution: WorkFormExecution }> = ({ execution }) => {
  const events = React.useMemo(() => buildExecutionStory(execution), [execution]);

  return (
    <section aria-labelledby="execution-story-heading">
      <StoryHeaderRow>
        <StoryHeading id="execution-story-heading">
          Execution story
        </StoryHeading>
        <TimestampText>
          {execution.started_at ? (
            <time dateTime={execution.started_at}>Started: {formatTs(execution.started_at)}</time>
          ) : null}
          {execution.completed_at ? (
            <>
              {' '}•{' '}
              <time dateTime={execution.completed_at}>Completed: {formatTs(execution.completed_at)}</time>
            </>
          ) : null}
        </TimestampText>
      </StoryHeaderRow>

      {events.length === 0 ? (
        <EmptyMessage>
          No events recorded yet.
        </EmptyMessage>
      ) : (
        <EventList
          role="list"
          aria-label="Execution story"
        >
          {events.map((ev) => {
            const styles = variantStyles(ev.variant);
            return (
              <EventItem
                key={ev.key}
                role="listitem"
                $borderColor={styles.border}
                $bgColor={styles.background}
              >
                <EventContentRow>
                  <EventDetailsColumn>
                    <EventTitle>{ev.title}</EventTitle>

                    {ev.node?.id ? (
                      <StepInfo>
                        Step:{' '}
                        <BoldSpan>
                          {ev.node.label ?? ev.node.id}
                        </BoldSpan>
                        {ev.node.label ? (
                          <TertiarySpan> ({ev.node.id})</TertiarySpan>
                        ) : null}
                        {ev.node.type ? <span> • {ev.node.type}</span> : null}
                      </StepInfo>
                    ) : null}

                    {ev.description ? (
                      <EventDescription style={{ color: styles.color }}>{ev.description}</EventDescription>
                    ) : null}
                  </EventDetailsColumn>

                  {ev.ts ? (
                    <EventTimestamp dateTime={ev.ts}>
                      {formatTs(ev.ts)}
                    </EventTimestamp>
                  ) : null}
                </EventContentRow>

                {ev.meta ? (
                  <DetailsSection>
                    <DetailsSummary>
                      Details (JSON)
                    </DetailsSummary>
                    <CodeBlock>
                      {JSON.stringify(ev.meta, null, 2)}
                    </CodeBlock>
                  </DetailsSection>
                ) : null}
              </EventItem>
            );
          })}
        </EventList>
      )}
    </section>
  );
};

/* ─── Styled Components ─── */

const StoryHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const StoryHeading = styled.h2`
  margin: 0;
  font-size: 15px;
  font-weight: 700;
`;

const TimestampText = styled.div`
  color: rgb(var(--color-text-tertiary));
  font-size: 12px;
`;

const EmptyMessage = styled.div`
  color: rgb(var(--color-text-secondary));
  margin-top: 8px;
`;

const EventList = styled.ol`
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const EventItem = styled.li<{ $borderColor: string; $bgColor: string }>`
  border: 1px solid ${p => p.$borderColor};
  border-radius: 12px;
  padding: 12px;
  background: ${p => p.$bgColor};
`;

const EventContentRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
`;

const EventDetailsColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const EventTitle = styled.div`
  font-weight: 700;
  color: rgb(var(--color-text-primary));
`;

const StepInfo = styled.div`
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
`;

const BoldSpan = styled.span`
  font-weight: 600;
`;

const TertiarySpan = styled.span`
  color: rgb(var(--color-text-tertiary));
`;

const EventDescription = styled.div`
  font-size: 13px;
  font-weight: 600;
`;

const EventTimestamp = styled.time`
  color: rgb(var(--color-text-tertiary));
  font-size: 12px;
`;

const DetailsSection = styled.details`
  margin-top: 8px;
`;

const DetailsSummary = styled.summary`
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
`;

const CodeBlock = styled.pre`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  padding: 12px;
  overflow: auto;
  max-height: 240px;
  margin-top: 8px;
`;
