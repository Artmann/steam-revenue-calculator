import React from 'react';
import styled from 'styled-components';
import Card from './card';

interface BreakdownProps {
  grossRevenue: number;
}

const Container = styled.div`
  font-size: 0.85rem;
  letter-spacing: 0.02em;
  padding: 1.5rem;
  text-transform: uppercase;
`;

const Line = styled.div`
  border-bottom: #CBD5E0 dashed 1px;
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
`;

const Label = styled.div``;

const Amount = styled.div`
  padding-left: 6rem;
  text-align: right;
`;

export default function Breakdown({ grossRevenue }: BreakdownProps) {
  const formatter = Intl.NumberFormat('en-US', {
    currency: 'USD',
    style: 'currency'
  });

  const adjustments: { [index: string]: number } = {
    vat: 0.2,
    returns: 0.08,
    regional: 0.2,
    discounts: 0.2,
    platform: 0.3
  };

  let workingRevenue = grossRevenue;
  const adjustmentAmounts = Object.keys(adjustments).reduce((carry, key) => {
    const amount = workingRevenue * adjustments[key];

    workingRevenue = Math.max(0, workingRevenue - amount);

    return {
      ...carry,
      [key]: amount
    };
  }, { }) as { [ index: string ]: number };

  const netRevenue = Object.keys(adjustmentAmounts).reduce((revenue, key) => {
    return revenue - adjustmentAmounts[key];
  }, grossRevenue);

  const lines = [
    { key: 'gross-revenue', label: 'Gross Revenue', value: grossRevenue },
    { key: 'vat', label: 'VAT', value: adjustmentAmounts['vat'] },
    { key: 'returns', label: 'Returns', value: adjustmentAmounts['returns'] },
    { key: 'regional-pricing', label: 'Adj. Regional Pricing', value: adjustmentAmounts['regional'] },
    { key: 'discounts', label: 'Discounts', value: adjustmentAmounts['discounts'] },
    { key: 'platform', label: 'Steam Cut', value: adjustmentAmounts['platform'] }
  ];

  const formatNumber = (value: number) => formatter.format(Math.round(value));

  return (
    <Card>
      <Container>

        {
          lines.map(line =>
            <Line key={ line.key }>
              <Label>{ line.label }</Label>
              <Amount data-testid={ line.key }>
                { formatNumber(line.value) }
              </Amount>
            </Line>
          )
        }

        <Line style={{ fontWeight: 700 }}>
          <Label>Net Revenue</Label>
          <Amount data-testid="net-revenue">
            { formatNumber(netRevenue) }
          </Amount>
        </Line>
      </Container>
    </Card>
  );
}
