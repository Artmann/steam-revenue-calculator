import React, { useState } from 'react';
import styled from 'styled-components';

import Breakdown from './breakdown';
import InputForm from './input-form';
import TotalRevenue from './total-revenue';

const Background = styled.div`
  background: url('/images/background-mobile.jpg') no-repeat;
  background-position: center center;
  background-size: cover;

  @media only screen and (min-width: 767px) {
    background-image: url('/images/background.jpg');
  }
  @media only screen and (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
    background-image: url('/images/background-2x.jpg');
  }

  height: 100%;
  width: 100%;
`;
const Blurb = styled.p`
  color: #fff;
  line-height: 1.625;
  margin-bottom: 4rem;
  max-width: 24rem;

  a {
    color: #ddd;
    text-decoration: underline;
  }
`;
const Column = styled.div`
  padding: 1rem;
`;
const Container = styled.div`
  display: flex;
  flex-wrap: wrap;
  height: 100vh;
  justify-content: center;
  margin: 0 auto;
  max-width: 62rem;
  padding: 2rem;
  padding-top: 8rem;
`;
const Header = styled.h1`
  color: #fff;
  max-width: 24rem;
  margin: 0;
  margin-bottom: 1rem;
`;
const Overlay = styled.div`
  background: rgba(38, 31, 68, 0.85);
  height: 100%;
  width: 100%;
`;

export default function App() {
  const [ numberOfReviews, setNumberOfReviews ] = useState(387);
  const [ price, setPrice ] = useState(16.99);

  const numberOfOwners = numberOfReviews * 45.0;
  const totalRevenue = numberOfOwners * price;

  return (
    <Background>
      <Overlay>
        <Container>
          <Column style={{ paddingRight: '6rem' }}>
            <Header>Calculate Revenue from Steam Games</Header>
            <Blurb>
              Using the <a href="http://greyaliengames.com/blog/how-to-estimate-how-many-sales-a-steam-game-has-made">Boxleiter method </a>
              we can use the number of review a game has on Steam to estimate the number of owners. From this, we can
              calculate the gross revenue and by adjusting for discounts, regional pricing, etc. we can get a rough
              idea of the net revune.
            </Blurb>

            <InputForm
              numberOfReviews={ numberOfReviews }
              price={ price }
              onNumberOfReviewsChanged={ (value: number) => setNumberOfReviews(value) }
              onPriceChanged={ (value: number) => setPrice(value) }
              />
          </Column>

          <Column>
            <TotalRevenue revenue={ totalRevenue } />
            <Breakdown grossRevenue={ totalRevenue } />
          </Column>
        </Container>
      </Overlay>
    </Background>
  );
}
