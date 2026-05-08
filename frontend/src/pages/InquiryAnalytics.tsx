/**
 * Inquiry Analytics Page
 *
 * Win/Loss reporting dashboard for inquiry performance tracking.
 */
import React from 'react';
import styled from 'styled-components';
import { InquiryAnalyticsDashboard } from '../components/Inquiry';

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const InquiryAnalytics: React.FC = () => {
  return (
    <Container>
      <InquiryAnalyticsDashboard />
    </Container>
  );
};

export default InquiryAnalytics;
