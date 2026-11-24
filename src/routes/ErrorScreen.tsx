import { useRouteError } from 'react-router';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/** Error boundary for the whole route tree (PRD 10, Reliability). */
export default function ErrorScreen() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.warn(error);

  return (
    <div className="app-root flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas p-6 text-center text-ink">
      <span className="flex size-16 items-center justify-center rounded-3xl bg-danger/10 text-danger-ink">
        <TriangleAlert size={28} aria-hidden />
      </span>
      <h1 className="text-xl font-semibold">Something went wrong.</h1>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </div>
  );
}
