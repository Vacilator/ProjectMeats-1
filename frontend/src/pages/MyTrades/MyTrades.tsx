/**
 * MyTrades Page Component
 *
 * Placeholder page for viewing the current user's active trades,
 * purchase orders, sales orders, and related transactions.
 */
import React from 'react';
import styled from 'styled-components';
import { Empty } from 'antd';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const MyTrades: React.FC = () => {
  useDocumentTitle('My Trades');

  return (
    <Container>
      <Header>
        <Title>My Trades</Title>
      </Header>
      <Empty
        description="Your active trades, purchase orders, and sales orders will appear here."
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    </Container>
  );
};

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0;
`;

export { MyTrades };
export default MyTrades;
