/**
 * The signed-in user's data (profile, subscriptions, records, activities), cached in the
 * browser as subsense_data_<userId>. Actions live in ./slices; ./sync keeps real accounts in
 * step with the cloud. The demo account exists only in this cache.
 *
 * The persist storage follows `activeUserId`: bindDataStoreToUser() switches it on
 * login/logout, so one account never sees another's data.
 * Every user-visible change goes through an action and appends an Activity.
 */
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { emptyUserData, isUserData } from '@/engine/userData';
import { newId } from '@/lib/id';
import { STORAGE_KEYS } from '@/lib/storageKeys';
import type { UserData } from '@/types/models';
import { getNowIso } from './clockStore';
import { createActionSlice } from './slices/actionSlice';
import { createPickSlice } from './slices/pickSlice';
import { createProfileSlice } from './slices/profileSlice';
import { createSubscriptionSlice } from './slices/subscriptionSlice';
import { createUsageSlice } from './slices/usageSlice';
import type { DataState } from './slices/types';
import { showToast } from './uiStore';

export type { DataState } from './slices/types';
export type { DeletedSnapshot } from './slices/subscriptionSlice';

const DATA_VERSION = 1;
let activeUserId: string | null = null;
let activeStorage: Storage | null = null;

/** The parts of the store that are the user's data (the rest are actions). */
export const USER_DATA_KEYS = Object.keys(emptyUserData()) as Array<keyof UserData>;

// ---------- Storage bound to the active user ----------

function readRaw(userId: string, storage: Storage): StorageValue<UserData> | null | 'corrupt' {
  const raw = storage.getItem(STORAGE_KEYS.userData(userId));
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as StorageValue<UserData>;
    return isUserData(parsed?.state) ? parsed : 'corrupt';
  } catch {
    return 'corrupt';
  }
}

const userStorage: PersistStorage<UserData> = {
  getItem: () => {
    if (!activeUserId || !activeStorage) return null;
    const value = readRaw(activeUserId, activeStorage);
    return value === 'corrupt' ? null : value;
  },
  setItem: (_name, value) => {
    if (!activeUserId || !activeStorage) return;
    activeStorage.setItem(STORAGE_KEYS.userData(activeUserId), JSON.stringify(value));
  },
  removeItem: () => {
    if (activeUserId) activeStorage?.removeItem(STORAGE_KEYS.userData(activeUserId));
  },
};

// ---------- Store ----------

function pickUserData(s: UserData): UserData {
  return {
    profile: s.profile,
    subscriptions: s.subscriptions,
    usages: s.usages,
    charges: s.charges,
    priceChanges: s.priceChanges,
    savings: s.savings,
    actionStates: s.actionStates,
    dismissedPicks: s.dismissedPicks,
    activities: s.activities,
  };
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get, api) => ({
      ...emptyUserData(),

      logActivity: (type, text, opts = {}) => {
        const id = newId();
        set({
          activities: [
            ...get().activities,
            {
              id,
              type,
              at: opts.at ?? getNowIso(),
              subId: opts.subId,
              data: opts.data ?? {},
              text,
            },
          ],
        });
        return id;
      },

      replaceAll: (data) => set({ ...data }),

      ...createProfileSlice(set, get, api),
      ...createSubscriptionSlice(set, get, api),
      ...createUsageSlice(set, get, api),
      ...createActionSlice(set, get, api),
      ...createPickSlice(set, get, api),
    }),
    {
      name: 'subsense_data',
      version: DATA_VERSION,
      storage: userStorage,
      skipHydration: true,
      partialize: (s): UserData => pickUserData(s),
    },
  ),
);

// ---------- Binding to a user ----------

/** Whose data the store currently holds. */
export function boundUserId(): string | null {
  return activeUserId;
}

/** The current user's data, without the actions. */
export function snapshotUserData(): UserData {
  return pickUserData(useDataStore.getState());
}

/** The copy of a user's data kept in this browser, if there is a readable one. */
export function readCachedData(userId: string, storage: Storage): UserData | null {
  const value = readRaw(userId, storage);
  return value === null || value === 'corrupt' ? null : value.state;
}

/**
 * Point the store at `userId` (or nobody) and bring billing up to today. `data` is the loaded
 * cloud data; without it (demo) the cached copy is used, and a missing or corrupt copy is
 * reset with a toast, never a blank screen.
 */
export function bindDataStoreToUser(
  userId: string | null,
  opts: { data?: UserData; storage?: Storage } = {},
): void {
  activeUserId = null; // detach first so clearing does not overwrite anyone's data
  activeStorage = null;
  if (!userId) {
    useDataStore.setState(emptyUserData());
    return;
  }

  const storage = opts.storage ?? localStorage;
  const data = opts.data ?? readCachedData(userId, storage);
  if (!data) showToast("We couldn't read your saved data, so it was reset.");
  activeUserId = userId;
  activeStorage = storage;
  useDataStore.setState(data ?? emptyUserData()); // also writes the cache
  useDataStore.getState().runRollover();
}

/** Write a full data blob for a user who may not be the active one (demo reset). */
export function writeUserData(userId: string, data: UserData): void {
  if (userId === activeUserId) {
    useDataStore.getState().replaceAll(data);
    return;
  }
  const value: StorageValue<UserData> = { state: data, version: DATA_VERSION };
  localStorage.setItem(STORAGE_KEYS.userData(userId), JSON.stringify(value));
}

/** Forget a user's cached copy (after logging out or deleting the account). */
export function removeCachedData(userId: string, storage: Storage): void {
  storage.removeItem(STORAGE_KEYS.userData(userId));
}
