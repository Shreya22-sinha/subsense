/** Which phone the desktop frame shows, and at what size. A browser-wide display preference. */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_DEVICE_ID, getDevice, type Device } from '@/data/devices';
import { STORAGE_KEYS } from '@/lib/storageKeys';

/** `fit` shrinks the phone to the window; `actual` is full size and the page scrolls. */
export type FrameSize = 'fit' | 'actual';

interface DeviceState {
  deviceId: string;
  size: FrameSize;
  setDevice: (id: string) => void;
  setSize: (size: FrameSize) => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      deviceId: DEFAULT_DEVICE_ID,
      size: 'fit',
      setDevice: (deviceId) => set({ deviceId }),
      setSize: (size) => set({ size }),
    }),
    {
      name: STORAGE_KEYS.device,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ deviceId: s.deviceId, size: s.size }),
    },
  ),
);

export function useDevice(): Device {
  return getDevice(useDeviceStore((s) => s.deviceId));
}
