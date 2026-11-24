/** Route guards (PRD 5, Guards). */
import { Navigate, Outlet, useLocation } from 'react-router';
import { BottomNav } from '@/components/layout/BottomNav';
import { useAuthStore } from '@/store/authStore';
import { useDataStore } from '@/store/dataStore';

export interface FromState {
  from?: string;
}

/** Signed-out users go to /login and come back to the route they asked for afterwards. */
export function RequireAuth() {
  const signedIn = useAuthStore((s) => s.sessionUserId !== null);
  const signedOutByUser = useAuthStore((s) => s.signedOutByUser);
  const location = useLocation();

  if (!signedIn) {
    // After an explicit Log out, go to the landing page rather than bouncing through Login.
    if (signedOutByUser) return <Navigate to="/" replace />;
    const state: FromState = { from: location.pathname + location.search };
    return <Navigate to="/login" replace state={state} />;
  }
  return <Outlet />;
}

/** Signed-in users who have not finished onboarding go to /onboarding. */
export function RequireOnboarded() {
  const done = useDataStore((s) => s.profile.onboardingDone);
  if (!done) return <Navigate to="/onboarding?step=1" replace />;
  return <Outlet />;
}

/**
 * /, /login and /register: signed-in users go to /home, or back to the route that sent
 * them to Login. This is also how Login, Register and the demo button navigate after success.
 */
export function PublicOnly() {
  const signedIn = useAuthStore((s) => s.sessionUserId !== null);
  const location = useLocation();
  if (signedIn) {
    const from = (location.state as FromState | null)?.from;
    return <Navigate to={from && from !== '/' ? from : '/home'} replace />;
  }
  return <Outlet />;
}

/** Signed-in tab screens with the bottom bar. */
export function TabLayout() {
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
