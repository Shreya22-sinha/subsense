/** What the app needs from its backend. supabase.ts implements it; tests use fake.ts. */
import type { User, UserData } from '@/types/models';

export type CloudErrorCode =
  | 'email_taken'
  | 'invalid_login'
  | 'weak_password'
  | 'invalid_email'
  | 'needs_confirmation'
  | 'rate_limited'
  | 'not_configured'
  /** The server could not be reached, or answered unexpectedly. */
  | 'unavailable';

export class CloudError extends Error {
  readonly code: CloudErrorCode;
  constructor(code: CloudErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'CloudError';
    this.code = code;
  }
}

export interface RemoteData {
  data: unknown;
  /** Server timestamp of the last save; identifies the version we loaded. */
  updatedAt: string;
}

export type SaveResult = { ok: true; updatedAt: string } | { ok: false; conflict: true };

export interface Cloud {
  /** Is there a saved login in this browser? Cheap: does not contact the server. */
  hasSession: () => boolean;
  currentUser: () => Promise<User | null>;
  signUp: (input: {
    name: string;
    email: string;
    password: string;
    remember: boolean;
    privacyVersion: string;
  }) => Promise<User>;
  signIn: (input: { email: string; password: string; remember: boolean }) => Promise<User>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  loadData: (userId: string) => Promise<RemoteData | null>;
  /** Saves only if the server still has version `base` (null = no row yet). */
  saveData: (userId: string, data: UserData, base: string | null) => Promise<SaveResult>;
  recordOpen: () => Promise<void>;
  recordDemoVisit: () => Promise<void>;
  /** Called when the signed-in user changes outside this tab (or the login expires). */
  onUserChange: (listener: (userId: string | null) => void) => void;
}
