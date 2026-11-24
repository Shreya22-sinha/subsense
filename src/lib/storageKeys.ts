/** Every browser-storage key the app uses (PRD 4, Persistence). */
export const STORAGE_KEYS = {
  session: 'subsense_session',
  clock: 'subsense_clock',
  device: 'subsense_device',
  /** The last day this browser was counted as a demo visit. */
  demoDay: 'subsense_demo_day',
  /** Sync bookkeeping for a cloud user's offline copy. */
  sync: (userId: string) => `subsense_sync_${userId}`,
  userData: (userId: string) => `subsense_data_${userId}`,
} as const;
