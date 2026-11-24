import { describe, expect, it } from 'vitest';
import { budgetStatus } from './budget';

describe('budgetStatus', () => {
  it('is green under 80%', () => {
    expect(budgetStatus(159900, 200000)).toMatchObject({
      level: 'green',
      over: false,
      headroomPaise: 40100,
    });
  });
  it('is amber from 80% to 100% inclusive', () => {
    expect(budgetStatus(160000, 200000).level).toBe('amber');
    expect(budgetStatus(200000, 200000)).toMatchObject({
      level: 'amber',
      over: false,
      headroomPaise: 0,
    });
  });
  it('is red and over above 100%', () => {
    expect(budgetStatus(210000, 200000)).toMatchObject({
      level: 'red',
      over: true,
      headroomPaise: -10000,
    });
  });
  it('handles a zero budget', () => {
    expect(budgetStatus(0, 0)).toMatchObject({ ratio: 0, level: 'green', over: false });
  });
});
