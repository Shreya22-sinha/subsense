import { describe, expect, it } from 'vitest';
import {
  emptyFormValues,
  toSubscriptionInput,
  validateSubscriptionForm,
  type SubscriptionFormValues,
} from './subscriptionForm';

const today = '2026-11-22';
const valid: SubscriptionFormValues = {
  ...emptyFormValues(today, 3),
  name: 'Netflix',
  category: 'Video',
  price: '649',
};
const errorsFor = (patch: Partial<SubscriptionFormValues>) =>
  validateSubscriptionForm({ ...valid, ...patch }, today);

describe('validateSubscriptionForm', () => {
  it('accepts a minimal valid form', () => {
    expect(validateSubscriptionForm(valid, today)).toEqual({});
  });

  it('requires name, category and price', () => {
    const e = validateSubscriptionForm(emptyFormValues(today, 3), today);
    expect(Object.keys(e).sort()).toEqual(['category', 'name', 'price']);
  });

  it('limits price to ₹0–₹1,00,000 and allows ₹0 only for a free plan', () => {
    expect(errorsFor({ price: '100001' }).price).toBeDefined();
    expect(errorsFor({ price: '-5' }).price).toBeDefined();
    expect(errorsFor({ price: '0' }).price).toMatch(/free/i);
    expect(errorsFor({ price: '0', planName: 'Free tier' }).price).toBeUndefined();
  });

  it('rejects a start date more than 10 years ago, allows the future', () => {
    expect(errorsFor({ startDate: '2016-11-21' }).startDate).toBeDefined();
    expect(errorsFor({ startDate: '2016-11-22' }).startDate).toBeUndefined();
    expect(errorsFor({ startDate: '2027-01-01' }).startDate).toBeUndefined();
  });

  it('checks trial length only when the trial is on', () => {
    expect(errorsFor({ isTrial: true, trialDays: '0' }).trialDays).toBeDefined();
    expect(errorsFor({ isTrial: true, trialDays: '366' }).trialDays).toBeDefined();
    expect(errorsFor({ isTrial: true, trialDays: '30' }).trialDays).toBeUndefined();
    expect(errorsFor({ isTrial: false, trialDays: '0' }).trialDays).toBeUndefined();
  });

  it('requires the end date to be after the start date', () => {
    expect(errorsFor({ endDate: '2026-11-22' }).endDate).toBeDefined();
    expect(errorsFor({ endDate: '2026-11-23' }).endDate).toBeUndefined();
  });

  it('rejects a past next-charge override', () => {
    expect(errorsFor({ nextChargeOverride: '2026-11-21' }).nextCharge).toBeDefined();
    expect(errorsFor({ nextChargeOverride: '2026-11-22' }).nextCharge).toBeUndefined();
  });

  it('limits sharing to 1–10 people', () => {
    expect(errorsFor({ sharedWith: '0' }).sharedWith).toBeDefined();
    expect(errorsFor({ sharedWith: '11' }).sharedWith).toBeDefined();
    expect(errorsFor({ sharedWith: '4' }).sharedWith).toBeUndefined();
  });

  it('never accepts a card number in Paid with', () => {
    expect(errorsFor({ paidWith: '4111 1111 1111 1111' }).paidWith).toMatch(/card/i);
    expect(errorsFor({ paidWith: '4111-1111-1111' }).paidWith).toBeDefined();
    expect(errorsFor({ paidWith: 'HDFC card ending 1234' }).paidWith).toBeUndefined();
    expect(errorsFor({ paidWith: 'x'.repeat(31) }).paidWith).toBeDefined();
  });

  it('limits notes to 200 characters', () => {
    expect(errorsFor({ notes: 'x'.repeat(201) }).notes).toBeDefined();
  });
});

describe('toSubscriptionInput', () => {
  it('converts rupees to paise and empty strings to null', () => {
    const input = toSubscriptionInput({ ...valid, price: '149.5', sharedWith: '2' });
    expect(input).toMatchObject({
      pricePaise: 14950,
      sharedWith: 2,
      endDate: null,
      trialDays: null,
    });
  });
});
