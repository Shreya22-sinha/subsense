/**
 * Phones the desktop frame can imitate. `width` x `height` is the screen in CSS pixels, so
 * the app lays out exactly as it would on that size of phone. Shapes are drawn generically
 * (no logos) and dimensions are approximate.
 */
export type Cutout = 'island' | 'punch' | 'none';

export interface SideButton {
  side: 'left' | 'right';
  /** Distance from the top of the body and length, in CSS px. */
  top: number;
  length: number;
}

export interface Device {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Screen corner radius. */
  radius: number;
  /** Black border between the glass edge and the screen: sides, top, bottom. */
  bezel: { side: number; top: number; bottom: number };
  /** Metal edge: thickness and the colours of its gradient. */
  edge: number;
  metal: [light: string, mid: string, dark: string];
  cutout: Cutout;
  /** Space kept clear for the status bar and the home bar. */
  statusBar: number;
  safeBottom: number;
  /** A physical home button below the screen (older phones). */
  homeButton?: boolean;
  statusStyle: 'ios' | 'android';
  buttons: SideButton[];
}

const IPHONE_BUTTONS: SideButton[] = [
  { side: 'left', top: 118, length: 32 },
  { side: 'left', top: 176, length: 62 },
  { side: 'left', top: 252, length: 62 },
  { side: 'right', top: 200, length: 98 },
];
const ANDROID_BUTTONS: SideButton[] = [
  { side: 'right', top: 150, length: 96 },
  { side: 'right', top: 272, length: 58 },
];
const PIXEL_BUTTONS: SideButton[] = [
  { side: 'right', top: 196, length: 58 },
  { side: 'right', top: 278, length: 104 },
];

export const DEVICES: Device[] = [
  {
    id: 'iphone-16',
    name: 'iPhone 16',
    width: 393,
    height: 852,
    radius: 55,
    bezel: { side: 9, top: 9, bottom: 9 },
    edge: 4,
    metal: ['#9aa0ab', '#4a4e57', '#23262c'],
    cutout: 'island',
    statusBar: 54,
    safeBottom: 26,
    statusStyle: 'ios',
    buttons: IPHONE_BUTTONS,
  },
  {
    id: 'iphone-16-pro-max',
    name: 'iPhone 16 Pro Max',
    width: 440,
    height: 956,
    radius: 60,
    bezel: { side: 6, top: 6, bottom: 6 },
    edge: 5,
    metal: ['#d8d2c8', '#a39b8f', '#6e675d'],
    cutout: 'island',
    statusBar: 56,
    safeBottom: 26,
    statusStyle: 'ios',
    buttons: IPHONE_BUTTONS,
  },
  {
    id: 'iphone-se',
    name: 'iPhone SE',
    width: 375,
    height: 667,
    radius: 2,
    bezel: { side: 16, top: 92, bottom: 96 },
    edge: 4,
    metal: ['#8d9097', '#3c3f45', '#1d1f23'],
    cutout: 'none',
    statusBar: 24,
    safeBottom: 0,
    homeButton: true,
    statusStyle: 'ios',
    buttons: [
      { side: 'left', top: 104, length: 28 },
      { side: 'left', top: 158, length: 46 },
      { side: 'left', top: 218, length: 46 },
      { side: 'right', top: 158, length: 60 },
    ],
  },
  {
    id: 'pixel-9',
    name: 'Pixel 9',
    width: 412,
    height: 923,
    radius: 50,
    bezel: { side: 8, top: 8, bottom: 9 },
    edge: 4,
    metal: ['#b9beb9', '#767c77', '#414642'],
    cutout: 'punch',
    statusBar: 44,
    safeBottom: 20,
    statusStyle: 'android',
    buttons: PIXEL_BUTTONS,
  },
  {
    id: 'galaxy-s24',
    name: 'Galaxy S24',
    width: 360,
    height: 780,
    radius: 38,
    bezel: { side: 6, top: 6, bottom: 7 },
    edge: 4,
    metal: ['#aeb2bb', '#646974', '#33373f'],
    cutout: 'punch',
    statusBar: 38,
    safeBottom: 20,
    statusStyle: 'android',
    buttons: ANDROID_BUTTONS,
  },
  {
    id: 'galaxy-s24-ultra',
    name: 'Galaxy S24 Ultra',
    width: 412,
    height: 892,
    radius: 10,
    bezel: { side: 5, top: 6, bottom: 6 },
    edge: 5,
    metal: ['#c3bfba', '#8b8680', '#565250'],
    cutout: 'punch',
    statusBar: 40,
    safeBottom: 20,
    statusStyle: 'android',
    buttons: ANDROID_BUTTONS,
  },
  {
    id: 'redmi-note-13',
    name: 'Redmi Note 13',
    width: 393,
    height: 873,
    radius: 32,
    bezel: { side: 7, top: 8, bottom: 11 },
    edge: 4,
    metal: ['#8fa3b8', '#48586a', '#222c38'],
    cutout: 'punch',
    statusBar: 40,
    safeBottom: 20,
    statusStyle: 'android',
    buttons: ANDROID_BUTTONS,
  },
];

export const DEFAULT_DEVICE_ID = 'iphone-16';

export function getDevice(id: string): Device {
  return DEVICES.find((d) => d.id === id) ?? DEVICES[0];
}

/** Outer size of the phone body, metal edge included. */
export function bodySize(d: Device): { width: number; height: number } {
  return {
    width: d.width + 2 * (d.bezel.side + d.edge),
    height: d.height + d.bezel.top + d.bezel.bottom + 2 * d.edge,
  };
}
