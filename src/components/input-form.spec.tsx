import '@testing-library/jest-dom/extend-expect';

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import InputForm from './input-form';

describe('Breakdown', () => {
  it('has correct initial values', async () => {
    render(
      <InputForm
        numberOfReviews={ 10 }
        price={ 14.99 }
        onNumberOfReviewsChanged={ () => {} }
        onPriceChanged={ () => {} }
      />
    );

    const reviewInput = screen.getByTestId('review-input');
    const priceInput = screen.getByTestId('price-input');

    expect(reviewInput).toHaveValue(10);
    expect(priceInput).toHaveValue(14.99);
  });

  it('clamps negative values', async () => {
    const reviewHandler = jest.fn();
    const priceHandler = jest.fn();

    render(
      <InputForm
        numberOfReviews={ 10 }
        price={ 14.99 }
        onNumberOfReviewsChanged={ reviewHandler }
        onPriceChanged={ priceHandler }
      />
    );

    const reviewInput = screen.getByTestId('review-input');
    const priceInput = screen.getByTestId('price-input');

    fireEvent.change(reviewInput, {
      target: {
        value: '-1'
      }
    });

    fireEvent.change(priceInput, {
      target: {
        value: '-1'
      }
    });

    expect(reviewHandler).toHaveBeenCalledWith(0);
    expect(priceHandler).toHaveBeenCalledWith(0.99);
  });

  it('fires an event  when values change', () => {
    const reviewHandler = jest.fn();
    const priceHandler = jest.fn();

    render(
      <InputForm
        numberOfReviews={ 10 }
        price={ 14.99 }
        onNumberOfReviewsChanged={ reviewHandler }
        onPriceChanged={ priceHandler }
      />
    );

    const reviewInput = screen.getByTestId('review-input');
    const priceInput = screen.getByTestId('price-input');

    fireEvent.change(reviewInput, {
      target: {
        value: '2500'
      }
    });

    fireEvent.change(priceInput, {
      target: {
        value: '8.89'
      }
    });

    expect(reviewHandler).toHaveBeenCalledWith(2500);
    expect(priceHandler).toHaveBeenCalledWith(8.89);
  });

  it('does not update values on invalid input', () => {
    const reviewHandler = jest.fn();
    const priceHandler = jest.fn();

    render(
      <InputForm
        numberOfReviews={ 10 }
        price={ 14.99 }
        onNumberOfReviewsChanged={ reviewHandler }
        onPriceChanged={ priceHandler }
      />
    );

    const reviewInput = screen.getByTestId('review-input');
    const priceInput = screen.getByTestId('price-input');

    fireEvent.change(reviewInput, {
      target: {
        value: 'hello'
      }
    });

    fireEvent.change(priceInput, {
      target: {
        value: 'world'
      }
    });

    expect(reviewHandler).toHaveBeenCalledWith(10);
    expect(priceHandler).toHaveBeenCalledWith(14.99);
  });

  it('clamps values that are to big', async () => {
    const reviewHandler = jest.fn();
    const priceHandler = jest.fn();

    render(
      <InputForm
        numberOfReviews={ 10 }
        price={ 14.99 }
        onNumberOfReviewsChanged={ reviewHandler }
        onPriceChanged={ priceHandler }
      />
    );

    const reviewInput = screen.getByTestId('review-input');
    const priceInput = screen.getByTestId('price-input');

    fireEvent.change(reviewInput, {
      target: {
        value: '999999999999999'
      }
    });

    fireEvent.change(priceInput, {
      target: {
        value: '898989'
      }
    });

    expect(reviewHandler).toHaveBeenCalledWith(9999999);
    expect(priceHandler).toHaveBeenCalledWith(999.99);
  });
});

