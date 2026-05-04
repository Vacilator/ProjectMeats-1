import React from 'react';
import styled from 'styled-components';
import { Theme } from '../../config/theme';
import { ConnectivityStatus, useConnectivity } from '../../contexts/ConnectivityContext';
import { useTheme } from '../../contexts/ThemeContext';

const BANNER_COPY: Record<
  Exclude<ConnectivityStatus, 'online'>,
  { title: string; message: string }
> = {
  offline: {
    title: "You're offline",
    message:
      'The app shell is still available, but live data refreshes and saves may pause until your connection returns.',
  },
  reconnecting: {
    title: 'Reconnecting...',
    message: 'Connection restored. Syncing the latest data now.',
  },
};

export const ConnectivityBanner: React.FC = () => {
  const { theme } = useTheme();
  const { status } = useConnectivity();

  if (status === 'online') {
    return null;
  }

  const copy = BANNER_COPY[status];

  return (
    <BannerRail $theme={theme}>
      <BannerCard
        $status={status}
        $theme={theme}
        aria-live="polite"
        data-testid="connectivity-banner"
        role="status"
      >
        <StatusDot $status={status} $theme={theme} aria-hidden="true" />
        <BannerText>
          <BannerTitle>{copy.title}</BannerTitle>
          <BannerMessage>{copy.message}</BannerMessage>
        </BannerText>
      </BannerCard>
    </BannerRail>
  );
};

const BannerRail = styled.div<{ $theme: Theme }>`
  padding: 0 1rem;
  background: ${(props) => props.$theme.colors.background};
  border-bottom: 1px solid ${(props) => props.$theme.colors.borderLight};
`;

const BannerCard = styled.div<{
  $status: Exclude<ConnectivityStatus, 'online'>;
  $theme: Theme;
}>`
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: ${(props) => props.$theme.colors.surface};
  border-left: 4px solid
    ${(props) =>
      props.$status === 'offline' ? props.$theme.colors.error : props.$theme.colors.warning};

  @media (max-width: 768px) {
    padding: 12px;
  }
`;

const StatusDot = styled.span<{
  $status: Exclude<ConnectivityStatus, 'online'>;
  $theme: Theme;
}>`
  width: 10px;
  height: 10px;
  margin-top: 6px;
  border-radius: 999px;
  flex: 0 0 auto;
  background: ${(props) =>
    props.$status === 'offline' ? props.$theme.colors.error : props.$theme.colors.warning};
`;

const BannerText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

const BannerTitle = styled.span`
  font-size: 14px;
  font-weight: 600;
`;

const BannerMessage = styled.span`
  font-size: 13px;
  line-height: 1.5;
`;
