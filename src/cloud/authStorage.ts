/**
 * Where a login and its offline copy live. "Remember me" uses localStorage; otherwise
 * sessionStorage, which the browser clears when the tab closes.
 */
export const AUTH_KEY = 'subsense_auth';

let remember = true;

export function setRemember(value: boolean): void {
  remember = value;
}

/** The storage holding the current login, or the one a new login should use. */
export function accountStorage(): Storage {
  if (localStorage.getItem(AUTH_KEY) !== null) return localStorage;
  if (sessionStorage.getItem(AUTH_KEY) !== null) return sessionStorage;
  return remember ? localStorage : sessionStorage;
}

export function hasStoredSession(): boolean {
  return localStorage.getItem(AUTH_KEY) !== null || sessionStorage.getItem(AUTH_KEY) !== null;
}

/** Storage adapter for the Supabase client. */
export const authStorage = {
  getItem: (key: string) => accountStorage().getItem(key),
  setItem: (key: string, value: string) => {
    const target = accountStorage();
    target.setItem(key, value);
    (target === localStorage ? sessionStorage : localStorage).removeItem(key);
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};
