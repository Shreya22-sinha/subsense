/**
 * Supabase backend. The library is loaded only when an account is used, so the landing page
 * and the demo stay fast and keep working when the database is unavailable.
 * Access is enforced by the database's own rules (supabase/schema.sql), not by this file.
 */
import type { AuthError, Session, SupabaseClient, User as AuthUser } from '@supabase/supabase-js';
import type { User } from '@/types/models';
import { AUTH_KEY, authStorage, hasStoredSession, setRemember } from './authStorage';
import { CloudError, type Cloud, type CloudErrorCode } from './types';

let clientPromise: Promise<SupabaseClient> | null = null;
let listener: ((userId: string | null) => void) | null = null;

function getClient(): Promise<SupabaseClient> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return Promise.reject(new CloudError('not_configured'));

  clientPromise ??= import('@supabase/supabase-js')
    .then(({ createClient }) => {
      const client = createClient(url, key, {
        auth: {
          storage: authStorage,
          storageKey: AUTH_KEY,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      });
      client.auth.onAuthStateChange((event, session: Session | null) => {
        if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') listener?.(session?.user.id ?? null);
      });
      return client;
    })
    .catch((e: unknown) => {
      clientPromise = null; // let the next attempt try again
      throw e;
    });
  return clientPromise;
}

const AUTH_CODES: Record<string, CloudErrorCode> = {
  user_already_exists: 'email_taken',
  email_exists: 'email_taken',
  invalid_credentials: 'invalid_login',
  weak_password: 'weak_password',
  email_address_invalid: 'invalid_email',
  validation_failed: 'invalid_email',
  email_not_confirmed: 'needs_confirmation',
  over_request_rate_limit: 'rate_limited',
  over_email_send_rate_limit: 'rate_limited',
};

function fromAuthError(error: AuthError): CloudError {
  return new CloudError(AUTH_CODES[error.code ?? ''] ?? 'unavailable', error.message);
}

function toUser(u: AuthUser): User {
  const name = u.user_metadata?.name as unknown;
  return {
    id: u.id,
    name: typeof name === 'string' && name.trim() ? name : 'there',
    email: u.email ?? '',
    createdAt: u.created_at,
    isDemo: false,
  };
}

/** Network failures become CloudError('unavailable'), whatever the library throws. */
async function guard<T>(run: (client: SupabaseClient) => Promise<T>): Promise<T> {
  try {
    return await run(await getClient());
  } catch (e) {
    if (e instanceof CloudError) throw e;
    throw new CloudError('unavailable', e instanceof Error ? e.message : String(e));
  }
}

const unavailable = (message: string) => new CloudError('unavailable', message);

export const supabaseCloud: Cloud = {
  hasSession: hasStoredSession,

  currentUser: () =>
    guard(async (c) => {
      const { data, error } = await c.auth.getSession();
      if (error) throw fromAuthError(error);
      return data.session ? toUser(data.session.user) : null;
    }),

  signUp: ({ name, email, password, remember, privacyVersion }) =>
    guard(async (c) => {
      setRemember(remember);
      const { data, error } = await c.auth.signUp({
        email,
        password,
        options: { data: { name, privacy_version: privacyVersion } },
      });
      if (error) throw fromAuthError(error);
      if (!data.user || !data.session) throw new CloudError('needs_confirmation');
      return toUser(data.user);
    }),

  signIn: ({ email, password, remember }) =>
    guard(async (c) => {
      setRemember(remember);
      const { data, error } = await c.auth.signInWithPassword({ email, password });
      if (error) throw fromAuthError(error);
      return toUser(data.user);
    }),

  signOut: () =>
    guard(async (c) => {
      // Local scope: other devices stay signed in, and it works offline.
      await c.auth.signOut({ scope: 'local' });
    }),

  deleteAccount: () =>
    guard(async (c) => {
      const { error } = await c.rpc('delete_my_account');
      if (error) throw unavailable(error.message);
      await c.auth.signOut({ scope: 'local' });
    }),

  loadData: (userId) =>
    guard(async (c) => {
      const { data, error } = await c
        .from('user_data')
        .select('data, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw unavailable(error.message);
      return data ? { data: data.data as unknown, updatedAt: data.updated_at as string } : null;
    }),

  saveData: (userId, data, base) =>
    guard(async (c) => {
      if (base === null) {
        const { data: row, error } = await c
          .from('user_data')
          .insert({ user_id: userId, data })
          .select('updated_at')
          .single();
        if (error?.code === '23505') return { ok: false, conflict: true };
        if (error) throw unavailable(error.message);
        return { ok: true, updatedAt: row.updated_at as string };
      }
      const { data: rows, error } = await c
        .from('user_data')
        .update({ data })
        .eq('user_id', userId)
        .eq('updated_at', base)
        .select('updated_at');
      if (error) throw unavailable(error.message);
      if (rows.length === 0) return { ok: false, conflict: true };
      return { ok: true, updatedAt: rows[0].updated_at as string };
    }),

  recordOpen: () =>
    guard(async (c) => {
      const { error } = await c.rpc('record_open');
      if (error) throw unavailable(error.message);
    }),

  recordDemoVisit: () =>
    guard(async (c) => {
      const { error } = await c.rpc('record_demo_visit');
      if (error) throw unavailable(error.message);
    }),

  onUserChange: (fn) => {
    listener = fn;
  },
};
