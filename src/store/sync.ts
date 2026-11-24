/**
 * Keeps a signed-in user's data in step with the cloud. The browser keeps a copy so the app
 * works offline; the cloud is the record.
 *
 * Safety rules:
 * - Nothing is saved until the user's data has been loaded, so a failed load can never
 *   overwrite real data with an empty account.
 * - A save names the version it is based on. If another device saved since, the save is
 *   refused and the newer data is loaded instead.
 * - Unsaved changes are flagged in the browser, so they are sent after a crash or a spell
 *   offline.
 */
import { create } from 'zustand';
import { accountStorage } from '@/cloud/authStorage';
import { cloud, CloudError } from '@/cloud';
import { emptyUserData, isUserData } from '@/engine/userData';
import { deepEqual } from '@/lib/deepEqual';
import { STORAGE_KEYS } from '@/lib/storageKeys';
import type { UserData } from '@/types/models';
import {
  bindDataStoreToUser,
  boundUserId,
  readCachedData,
  removeCachedData,
  snapshotUserData,
  useDataStore,
  USER_DATA_KEYS,
} from './dataStore';
import { showToast } from './uiStore';

export type SyncStatus = 'saved' | 'saving' | 'waiting';

/** For the "Saved" line in Settings. `waiting` = not saved yet, will retry. */
export const useSyncStore = create<{ status: SyncStatus }>()(() => ({ status: 'saved' }));
const setStatus = (status: SyncStatus) => useSyncStore.setState({ status });

const SAVE_DELAY_MS = 800;
const RETRY_MS = 15_000;
const LOGOUT_SAVE_MS = 4_000;
const PULL_EVERY_MS = 30_000;

interface Meta {
  base: string | null;
  dirty: boolean;
}

let userId: string | null = null;
/** Where this login's offline copy lives; fixed while it is open. */
let storage: Storage;
let base: string | null = null;
let dirty = false;
let applying = false;
let saving: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let lastAttempt: UserData | null = null;
let lastPull = 0;
let stopWatching: (() => void) | null = null;

function readMeta(id: string): Meta | null {
  try {
    return JSON.parse(storage.getItem(STORAGE_KEYS.sync(id)) ?? 'null') as Meta | null;
  } catch {
    return null;
  }
}

function writeMeta(): void {
  if (userId) storage.setItem(STORAGE_KEYS.sync(userId), JSON.stringify({ base, dirty }));
}

function schedule(ms: number): void {
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), ms);
}

function markDirty(): void {
  if (!dirty) {
    dirty = true;
    writeMeta();
  }
  setStatus('saving');
  schedule(SAVE_DELAY_MS);
}

/** Show `data` for the bound user without treating it as a new change. */
function apply(id: string, data: UserData): void {
  applying = true;
  bindDataStoreToUser(id, { data, storage });
  applying = false;
  // Opening the app can record charges that fell due; those do need saving.
  const now = useDataStore.getState();
  if (USER_DATA_KEYS.some((k) => now[k] !== data[k])) markDirty();
}

function parseRemote(data: unknown): UserData {
  const merged = { ...emptyUserData(), ...(data as object) };
  if (!isUserData(merged)) throw new CloudError('unavailable', 'saved data is unreadable');
  return merged;
}

function watch(): void {
  stopWatching?.();
  const unsub = useDataStore.subscribe((s, prev) => {
    // Only this user's own edits count, never the store being cleared or switched.
    if (applying || boundUserId() !== userId) return;
    if (USER_DATA_KEYS.some((k) => s[k] !== prev[k])) markDirty();
  });
  const onOnline = () => void flush();
  const onVisible = () => {
    if (document.visibilityState === 'hidden') void flush();
    else if (Date.now() - lastPull > PULL_EVERY_MS) void pull().catch(() => undefined);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
  }
  stopWatching = () => {
    unsub();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    }
    stopWatching = null;
  };
}

/** Load a user's data and start saving changes. Throws if it can't be loaded at all. */
export async function openCloudUser(id: string): Promise<void> {
  storage = accountStorage();
  const cached = readCachedData(id, storage);
  const meta = readMeta(id);

  let remote: { data: UserData; updatedAt: string } | null = null;
  let reachable = true;
  try {
    const row = await cloud().loadData(id);
    remote = row && { data: parseRemote(row.data), updatedAt: row.updatedAt };
  } catch (e) {
    if (!cached) throw e;
    reachable = false;
  }

  userId = id;
  lastPull = Date.now();
  lastAttempt = null;
  watch();

  if (!reachable && cached) {
    base = meta?.base ?? null;
    dirty = meta?.dirty ?? false;
    apply(id, cached);
    setStatus('waiting');
    schedule(RETRY_MS);
    showToast("You're offline. Changes will be saved when you're back.");
    return;
  }

  const remoteVersion = remote?.updatedAt ?? null;
  base = remoteVersion;
  const unsaved = !!cached && !!meta?.dirty;
  if (unsaved && meta.base === remoteVersion) {
    dirty = true;
    apply(id, cached);
    markDirty();
    return;
  }
  dirty = false;
  setStatus('saved');
  if (remote) {
    apply(id, remote.data);
    writeMeta();
    if (unsaved) showToast('Loaded newer changes from your other device.');
  } else {
    apply(id, emptyUserData());
    markDirty(); // creates the row
  }
}

/** Fetch newer data saved by another device. `force` replaces unsaved local changes. */
async function pull(force = false): Promise<void> {
  const id = userId;
  if (!id || (dirty && !force)) return;
  lastPull = Date.now();
  const row = await cloud().loadData(id);
  if (id !== userId || (dirty && !force)) return;
  if (!row) {
    base = null; // deleted elsewhere; a later save tries to create it again
    if (force) throw new CloudError('unavailable', 'saved data is gone');
    return;
  }
  if (row.updatedAt === base) return;

  if (force && lastAttempt && deepEqual(row.data, lastAttempt)) {
    // Our own earlier save did arrive; only its reply was lost. Keep the local changes.
    base = row.updatedAt;
    markDirty();
    writeMeta();
    return;
  }
  const data = parseRemote(row.data);
  base = row.updatedAt;
  dirty = false;
  apply(id, data);
  writeMeta();
  if (!dirty) setStatus('saved');
  if (force) showToast('Loaded newer changes from your other device.');
}

/** Save unsaved changes now. Never throws; failures are retried. */
export function flush(): Promise<void> {
  if (saving)
    return saving.then(() =>
      dirty && useSyncStore.getState().status !== 'waiting' ? flush() : undefined,
    );
  if (!userId || !dirty || boundUserId() !== userId) return Promise.resolve();
  clearTimeout(timer);

  const id = userId;
  const snapshot = snapshotUserData();
  dirty = false;
  setStatus('saving');
  saving = (async () => {
    try {
      const result = await cloud().saveData(id, snapshot, base);
      if (id !== userId) return;
      if (result.ok) {
        base = result.updatedAt;
        lastAttempt = null;
      } else {
        dirty = true;
        await pull(true);
        if (id !== userId) return;
      }
      writeMeta();
      setStatus(dirty ? 'saving' : 'saved');
      if (dirty) schedule(SAVE_DELAY_MS);
    } catch {
      if (id !== userId) return;
      lastAttempt = snapshot;
      dirty = true;
      writeMeta();
      setStatus('waiting');
      schedule(RETRY_MS);
    }
  })().finally(() => {
    saving = null;
  });
  return saving;
}

/** Stop syncing. `discard` (account deleted) drops local copies without saving. */
export async function closeCloudUser(opts: { discard?: boolean } = {}): Promise<void> {
  const id = userId;
  if (!id) return;
  if (!opts.discard) {
    await Promise.race([flush(), new Promise((r) => setTimeout(r, LOGOUT_SAVE_MS))]);
  }
  const saved = !dirty && !saving;
  clearTimeout(timer);
  stopWatching?.();
  userId = null;
  bindDataStoreToUser(null);
  // Leave nothing behind on a shared computer, unless it hasn't reached the cloud yet.
  if (saved || opts.discard) {
    removeCachedData(id, storage);
    storage.removeItem(STORAGE_KEYS.sync(id));
  }
  base = null;
  dirty = false;
  setStatus('saved');
}
