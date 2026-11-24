import { describe, expect, it } from 'vitest';
import { BOM, csvCell, csvFileName, subscriptionsCsv } from './csv';
import { makeSub, taps, TODAY } from './testing';

describe('csvCell', () => {
  it('quotes and escapes every value', () => {
    expect(csvCell('Netflix')).toBe('"Netflix"');
    expect(csvCell('Say "hi", ok')).toBe('"Say ""hi"", ok"');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(3)).toBe('"3"');
  });
  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"');
    expect(csvCell('-5')).toBe('"\'-5"');
  });
});

describe('subscriptionsCsv', () => {
  it('writes a BOM, the PRD header and one row per subscription', () => {
    const s = makeSub({
      id: 'y',
      name: 'Amazon Prime',
      planName: 'Annual',
      pricePaise: 149900,
      cycle: 'yearly',
      sharedWith: 2,
      notes: 'Shared with "Riya"',
      paidWith: 'HDFC card',
    });
    const csv = subscriptionsCsv([s], taps('y', 4), TODAY);
    expect(csv.startsWith(BOM)).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines[0]).toBe(
      '"name","plan","category","price_rs","cycle","monthly_equivalent_rs","your_share_rs","start_date","next_charge","trial_end","end_date","status","auto_renew","usage_rating","uses_last_30_days","liking","paid_with","notes"',
    );
    expect(lines[1]).toBe(
      '"Amazon Prime","Annual","Video","1499","yearly","124.92","62.46","2026-09-10","2026-12-10","","","active","yes","3","4","","HDFC card","Shared with ""Riya"""',
    );
  });

  it('names the file by date', () => {
    expect(csvFileName(TODAY)).toBe('subsense_subscriptions_2026-11-22.csv');
  });
});
