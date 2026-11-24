import { useEffect, useId, useRef, useState } from 'react';
import { EllipsisVertical, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
}

/** Three-dot overflow menu. Closes on selection, Escape or a click outside. */
export function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink"
      >
        <EllipsisVertical size={20} aria-hidden />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="absolute top-full right-0 z-30 mt-1 min-w-40 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl"
        >
          {items.map(({ label: itemLabel, icon: Icon, onSelect, danger }) => (
            <button
              key={itemLabel}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSelect();
              }}
              className={cn(
                'flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm font-medium hover:bg-surface-2 focus:bg-surface-2 focus:outline-none',
                danger ? 'text-danger-ink' : 'text-ink',
              )}
            >
              <Icon size={18} aria-hidden />
              {itemLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
