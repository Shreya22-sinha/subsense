/** In-memory backend for tests. Not imported by app code. */
import type { User, UserData } from '@/types/models';
import {
  AUTH_KEY,
  accountStorage,
  authStorage,
  hasStoredSession,
  setRemember,
} from './authStorage';
import { CloudError, type Cloud } from './types';

interface Row {
  data: unknown;
  updatedAt: string;
}

export function createFakeCloud() {
  const accounts = new Map<string, { user: User; password: string }>();
  const rows = new Map<string, Row>();
  let seq = 0;
  let listener: ((id: string | null) => void) | null = null;
  const state = { offline: false, saves: 0, opens: 0, demoVisits: 0, loseNextReply: false };

  const net = () => {
    if (state.offline) throw new CloudError('unavailable');
  };
  const stamp = () => `v${++seq}`;
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  const startSession = (id: string) => authStorage.setItem(AUTH_KEY, id);

  const cloud: Cloud = {
    hasSession: hasStoredSession,
    currentUser: async () => {
      const id = accountStorage().getItem(AUTH_KEY);
      return [...accounts.values()].find((a) => a.user.id === id)?.user ?? null;
    },
    signUp: async ({ name, email, password, remember }) => {
      net();
      if (accounts.has(email)) throw new CloudError('email_taken');
      setRemember(remember);
      const user: User = {
        id: `user-${++seq}`,
        name,
        email,
        createdAt: new Date().toISOString(),
        isDemo: false,
      };
      accounts.set(email, { user, password });
      startSession(user.id);
      return user;
    },
    signIn: async ({ email, password, remember }) => {
      net();
      const account = accounts.get(email);
      if (!account || account.password !== password) throw new CloudError('invalid_login');
      setRemember(remember);
      startSession(account.user.id);
      return account.user;
    },
    signOut: async () => authStorage.removeItem(AUTH_KEY),
    deleteAccount: async () => {
      net();
      const id = accountStorage().getItem(AUTH_KEY);
      for (const [email, a] of accounts) if (a.user.id === id) accounts.delete(email);
      if (id) rows.delete(id);
      authStorage.removeItem(AUTH_KEY);
    },
    loadData: async (id) => {
      net();
      const row = rows.get(id);
      return row ? clone(row) : null;
    },
    saveData: async (id, data: UserData, base) => {
      net();
      if ((rows.get(id)?.updatedAt ?? null) !== base) return { ok: false, conflict: true };
      const row = { data: clone(data), updatedAt: stamp() };
      rows.set(id, row);
      state.saves += 1;
      if (state.loseNextReply) {
        state.loseNextReply = false;
        throw new CloudError('unavailable');
      }
      return { ok: true, updatedAt: row.updatedAt };
    },
    recordOpen: async () => {
      net();
      state.opens += 1;
    },
    recordDemoVisit: async () => {
      net();
      state.demoVisits += 1;
    },
    onUserChange: (fn) => {
      listener = fn;
    },
  };

  return {
    cloud,
    state,
    rows,
    /** Pretend another device saved something. */
    saveElsewhere: (id: string, data: UserData) =>
      rows.set(id, { data: clone(data), updatedAt: stamp() }),
    changeUser: (id: string | null) => listener?.(id),
  };
}
