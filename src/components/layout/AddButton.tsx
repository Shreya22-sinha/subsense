import { Link } from 'react-router';
import { Plus } from 'lucide-react';

/** "Add subscription" in the top bar, where it never covers other buttons. */
export function AddButton() {
  return (
    <Link
      to="/subs/new"
      aria-label="Add subscription"
      title="Add subscription"
      className="flex size-11 items-center justify-center rounded-full"
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-brand text-white hover:bg-brand-strong">
        <Plus size={22} aria-hidden />
      </span>
    </Link>
  );
}
