import { useState, type ReactNode } from 'react';
import { CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { initAuth, useAuthStore } from '@/store/authStore';

/** Holds back the app until a signed-in user's data is loaded, so it never looks empty. */
export function SessionGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const logout = useAuthStore((s) => s.logout);
  const [leaving, setLeaving] = useState(false);

  if (status === 'loading') {
    return (
      <div role="status" className="flex h-full flex-col items-center justify-center gap-4">
        <span className="size-10 animate-spin rounded-full border-4 border-brand-soft border-t-brand" />
        <p className="text-base text-ink-muted">Loading your subscriptions…</p>
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div className="flex h-full flex-col justify-center">
        <EmptyState
          icon={CloudOff}
          title="We couldn't load your data"
          body="Your data is safe. Check your connection and try again."
          action={
            <div className="flex flex-col gap-2">
              <Button onClick={() => void initAuth()}>Try again</Button>
              <Button
                variant="ghost"
                disabled={leaving}
                onClick={() => {
                  setLeaving(true);
                  void logout().finally(() => setLeaving(false));
                }}
              >
                Log out
              </Button>
            </div>
          }
        />
      </div>
    );
  }
  return children;
}
