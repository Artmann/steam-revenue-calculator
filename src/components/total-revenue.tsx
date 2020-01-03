import React from 'react';
import styled from 'styled-components';
import Card from './card';

interface TotalRevenueProps {
  revenue: number;
}

const Container = styled.div`
  padding: 1.5rem 2.5rem;
  text-align: center;
`;

const Revenue = styled.div`
  align-items: baseline;
  display: flex;
  font-weight: bold;
  justify-content: center;
  margin-bottom: 0.5rem;
  text-align: center;
  width: 100%;
`;
const Currency = styled.p`
  font-size: 1rem;
  margin: 0;
  margin-right: 0.25rem;
`;
const Amount = styled.p`
  font-size: 1.5rem;
  letter-spacing: 0.02em;
  margin: 0;
`;
const Hint = styled.p`
  color: #4A5568;
  font-size: 0.8rem;
  letter-spacing: 0.025em;
  margin: 0;
  text-align: center;
  text-transform: uppercase;
  width: 100%;
`;

export default function TotalRevenue({ revenue }: TotalRevenueProps) {
  const formatter = Intl.NumberFormat('en-US');
  const formatedRevenue = formatter.format(revenue);

  return (
    <Card>
      <Container>
        <Revenue data-testid="total-revenue">
          <Currency>$</Currency>
          <Amount>{ formatedRevenue }</Amount>
        </Revenue>
        <Hint>Total Revenue</Hint>
      </Container>
    </Card>
  );
}
