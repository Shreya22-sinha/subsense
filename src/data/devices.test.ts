import { describe, expect, it } from 'vitest';
import { bodySize, DEFAULT_DEVICE_ID, DEVICES, getDevice } from './devices';

describe('devices', () => {
  it('has unique ids and includes the default', () => {
    expect(new Set(DEVICES.map((d) => d.id)).size).toBe(DEVICES.length);
    expect(getDevice(DEFAULT_DEVICE_ID).id).toBe(DEFAULT_DEVICE_ID);
  });

  it('falls back to the first phone for an unknown saved id', () => {
    expect(getDevice('not-a-phone')).toBe(DEVICES[0]);
  });

  it('is a body larger than its screen, with side buttons that fit on it', () => {
    for (const d of DEVICES) {
      const body = bodySize(d);
      expect(body.width).toBeGreaterThan(d.width);
      expect(body.height).toBeGreaterThan(d.height);
      for (const b of d.buttons) expect(b.top + b.length).toBeLessThan(body.height);
    }
  });
});
