import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ActionsButton } from './ActionsButton';

interface ScreenProps {
  title: string;
  /** Show a back arrow. A string navigates to that path; `true` goes back in history. */
  back?: boolean | string;
  /** Hide the Actions button (public screens). */
  hideActions?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A page: fixed top bar plus an independently scrolling body (PRD 5). */
export function Screen({ title, back, hideActions, actions, children, className }: ScreenProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = () => {
    if (typeof back === 'string') navigate(back);
    // A screen opened directly (no history in the app) goes Home instead of leaving the app.
    else if (location.key === 'default') navigate('/home');
    else navigate(-1);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-1 bg-canvas px-2">
        {back ? (
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-2"
          >
            <ArrowLeft size={22} aria-hidden />
          </button>
        ) : (
          <span className="w-3" />
        )}
        <h1 className="flex-1 truncate text-xl font-bold text-ink">{title}</h1>
        {actions}
        {!hideActions && <ActionsButton />}
      </header>
      <main
        className={cn('scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-8', className)}
      >
        {children}
      </main>
    </div>
  );
}
