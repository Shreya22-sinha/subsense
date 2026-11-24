/**
 * Accounts. Real accounts live in the cloud (src/cloud); the demo account lives only in this
 * browser and never needs the database.
 */
import { create } from 'zustand';
import { cloud, CloudError, type CloudErrorCode } from '@/cloud';
import { buildDemoData, DEMO_USER } from '@/data/demoAccount';
import { newId } from '@/lib/id';
import { STORAGE_KEYS } from '@/lib/storageKeys';
import { normaliseEmail } from '@/lib/validation';
import type { User } from '@/types/models';
import { getNowIso, getToday, useClockStore } from './clockStore';
import { bindDataStoreToUser, readCachedData, useDataStore, writeUserData } from './dataStore';
import { clearSession, isDemoSession, writeDemoSession } from './session';
import { closeCloudUser, openCloudUser } from './sync';
import { showToast } from './uiStore';

const DAY_MS = 86_400_000;
const DEMO_ID = 'demo';
/** Date of the privacy notice people agree to when signing up. */
export const PRIVACY_VERSION = '2026-11-24';

export type AuthField = 'email' | 'password' | 'form';
export type AuthResult = { ok: true } | { ok: false; message: string; field: AuthField };

interface AuthState {
  /** `failed`: signed in, but the saved data could not be loaded. */
  status: 'loading' | 'ready' | 'failed';
  user: User | null;
  sessionUserId: string | null;
  /** True right after Log out, so guards send the user to Landing instead of Login. */
  signedOutByUser: boolean;

  register: (input: { name: string; email: string; password: string }) => Promise<AuthResult>;
  login: (input: { email: string; password: string; remember: boolean }) => Promise<AuthResult>;
  loginDemo: () => void;
  logout: () => Promise<void>;
  /** Delete the signed-in account and everything saved. False if the server refused. */
  deleteAccount: () => Promise<boolean>;
  /** Rebuild the demo account's data and reset the demo clock (PRD 9.3). */
  resetDemo: () => void;
}

const MESSAGES: Record<CloudErrorCode, { message: string; field: AuthField }> = {
  email_taken: { message: 'An account with this email already exists', field: 'email' },
  invalid_login: { message: 'Email or password is incorrect', field: 'form' },
  weak_password: { message: 'Choose a stronger password.', field: 'password' },
  invalid_email: { message: "This email address can't be used.", field: 'email' },
  needs_confirmation: { message: 'Check your email to confirm your account.', field: 'form' },
  rate_limited: { message: 'Too many tries. Wait a few minutes and try again.', field: 'form' },
  not_configured: { message: "Accounts aren't available here. Try the demo.", field: 'form' },
  unavailable: {
    message: "We couldn't reach the server. Check your connection and try again.",
    field: 'form',
  },
};

function failure(e: unknown): AuthResult {
  return { ok: false, ...MESSAGES[e instanceof CloudError ? e.code : 'unavailable'] };
}

function demoUser(): User {
  return { id: DEMO_ID, ...DEMO_USER, createdAt: new Date().toISOString(), isDemo: true };
}

function buildDemo() {
  const nowMs = new Date(getNowIso()).getTime();
  return buildDemoData({
    today: getToday(),
    at: (days) => new Date(nowMs + days * DAY_MS).toISOString(),
    newId,
  });
}

/** Our own sign-ins and sign-outs also trigger onUserChange; ignore those. */
let busy = 0;

async function openAccount(user: User): Promise<void> {
  // Real accounts always use the real date; time travel is for the demo only.
  bindDataStoreToUser(null);
  useClockStore.getState().resetOffset();
  await openCloudUser(user.id);
  cloud()
    .recordOpen()
    .catch(() => undefined); // only a statistic
}

export const useAuthStore = create<AuthState>()((set, get) => {
  const signInWith = async (
    authenticate: () => Promise<User>,
    activity: () => void,
  ): Promise<AuthResult> => {
    busy += 1;
    try {
      const user = await authenticate();
      try {
        await openAccount(user);
      } catch (e) {
        await cloud()
          .signOut()
          .catch(() => undefined);
        throw e;
      }
      clearSession();
      activity();
      set({ user, sessionUserId: user.id, signedOutByUser: false, status: 'ready' });
      return { ok: true };
    } catch (e) {
      return failure(e);
    } finally {
      busy -= 1;
    }
  };

  return {
    status: 'ready',
    user: null,
    sessionUserId: null,
    signedOutByUser: false,

    register: ({ name, email, password }) =>
      signInWith(
        () =>
          cloud().signUp({
            name: name.trim(),
            email: normaliseEmail(email),
            password,
            remember: true,
            privacyVersion: PRIVACY_VERSION,
          }),
        () =>
          useDataStore
            .getState()
            .logActivity('account_created', 'You created your SubSense account.'),
      ),

    login: ({ email, password, remember }) =>
      signInWith(
        () => cloud().signIn({ email: normaliseEmail(email), password, remember }),
        () => useDataStore.getState().logActivity('logged_in', 'You logged in.'),
      ),

    loginDemo: () => {
      // Loading the demo always rebuilds its data from today's real date (PRD 9.2).
      bindDataStoreToUser(null);
      useClockStore.getState().resetOffset();
      writeUserData(DEMO_ID, buildDemo());
      writeDemoSession();
      bindDataStoreToUser(DEMO_ID);
      set({
        user: demoUser(),
        sessionUserId: DEMO_ID,
        signedOutByUser: false,
        status: 'ready',
      });
      countDemoVisit();
    },

    logout: async () => {
      busy += 1;
      try {
        if (get().user?.isDemo) {
          bindDataStoreToUser(null);
          useClockStore.getState().resetOffset();
        } else {
          await closeCloudUser();
          await cloud()
            .signOut()
            .catch(() => undefined);
        }
        clearSession();
        set({ user: null, sessionUserId: null, signedOutByUser: true, status: 'ready' });
      } finally {
        busy -= 1;
      }
    },

    deleteAccount: async () => {
      busy += 1;
      try {
        await cloud().deleteAccount();
        await closeCloudUser({ discard: true });
        clearSession();
        set({ user: null, sessionUserId: null, signedOutByUser: true });
        return true;
      } catch {
        return false;
      } finally {
        busy -= 1;
      }
    },

    resetDemo: () => {
      if (!get().user?.isDemo) return;
      useClockStore.getState().resetOffset();
      writeUserData(DEMO_ID, buildDemo());
    },
  };
});

/** Add 1 to the anonymous demo counter, at most once a day per browser. */
function countDemoVisit(): void {
  if (import.meta.env.DEV && import.meta.env.MODE !== 'test') return;
  const today = new Date().toDateString();
  if (localStorage.getItem(STORAGE_KEYS.demoDay) === today) return;
  localStorage.setItem(STORAGE_KEYS.demoDay, today);
  cloud()
    .recordDemoVisit()
    .catch(() => localStorage.removeItem(STORAGE_KEYS.demoDay));
}

/** Restore the session on app load. Returns at once for visitors and the demo. */
export async function initAuth(): Promise<void> {
  cloud().onUserChange((id) => {
    const { user } = useAuthStore.getState();
    if (busy > 0 || !user || user.isDemo || user.id === id) return;
    // Signed out, or a different account signed in, in another tab: start clean.
    if (id === null) {
      showToast('You were logged out.');
      void useAuthStore.getState().logout();
    } else {
      window.location.reload();
    }
  });

  if (isDemoSession()) {
    if (!readCachedData(DEMO_ID, localStorage)) writeUserData(DEMO_ID, buildDemo());
    bindDataStoreToUser(DEMO_ID);
    useAuthStore.setState({ user: demoUser(), sessionUserId: DEMO_ID, status: 'ready' });
    return;
  }
  clearSession();
  useClockStore.getState().resetOffset();
  if (!cloud().hasSession()) {
    bindDataStoreToUser(null);
    useAuthStore.setState({ user: null, sessionUserId: null, status: 'ready' });
    return;
  }

  useAuthStore.setState({ status: 'loading' });
  busy += 1;
  try {
    const user = await cloud().currentUser();
    if (user) await openAccount(user);
    useAuthStore.setState({ user, sessionUserId: user?.id ?? null, status: 'ready' });
  } catch {
    useAuthStore.setState({ status: 'failed' });
  } finally {
    busy -= 1;
  }
}

export function useCurrentUser(): User | null {
  return useAuthStore((s) => s.user);
}

/** The demo tools (time travel, reset) are for the demo account only. */
export function useIsDemo(): boolean {
  return useAuthStore((s) => s.user?.isDemo ?? false);
}
