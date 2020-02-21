import React, { FormEvent } from 'react';
import styled from 'styled-components';

interface InputFormProps {
  numberOfReviews: number;
  price: number;
  onNumberOfReviewsChanged: (value: number) => void;
  onPriceChanged: (value: number) => void;
}

const Form = styled.form`
  display: flex;
  flex-wrap: wrap;
`;

const FormGroup = styled.div`
  margin: 0 2rem 2rem 0;
`;

const Label = styled.label`
  color: #ddd;
  display: block;
  font-size: 0.8rem;
  letter-spacing: 0.025em;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
`;

const Input = styled.input`
  appearance: none;
  background: transparent;
  border:none;
  border-bottom: solid 1px #fff;
  box-shadow: none;
  color: #fff;
  display: block;
  font-size: 1.65rem;
  font-weight: bold;
  padding: 0.25rem;
  width: 8rem;

  &:focus {
    outline: none;
  }
`;

function clamp(value: number, min: number, max: number): number {
  return Math.max(Math.min(value, max), min);
}

export default function InputForm({ numberOfReviews, price, onNumberOfReviewsChanged, onPriceChanged }: InputFormProps) {
  const reviewChangeHandler = (event: FormEvent<HTMLInputElement>) => {
    const value = clamp(
      parseInt(event.currentTarget.value, 10),
      0,
      9999999
    );

    onNumberOfReviewsChanged(value);
  };
  const priceChangeHandler = (event: FormEvent<HTMLInputElement>) => {
    const value = clamp(
      parseInt(event.currentTarget.value, 10),
      0.99,
      999.99
    );

    onPriceChanged(value);
  };

  return (
    <Form>
      <FormGroup>
        <Label htmlFor="numberOfReviews">
          Number of Reviews
        </Label>
        <Input
          type="number"
          data-testid="review-input"
          id="numberOfReviews"
          onChange={ reviewChangeHandler }
          value={ numberOfReviews }
          />
      </FormGroup>
      <FormGroup>
        <Label htmlFor="price">
          Price (USD)
        </Label>
        <Input
          type="number"
          data-testid="price-input"
          id="price"
          onChange={ priceChangeHandler }
          value={ price }
          />
      </FormGroup>
    </Form>
  );
}
