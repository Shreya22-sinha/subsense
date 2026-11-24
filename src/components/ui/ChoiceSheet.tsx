import type { ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

export interface Choice {
  label: string;
  onSelect: () => void;
}

/** A bottom sheet offering 2–3 equal-weight choices (declining is as easy as accepting). */
export function ChoiceSheet({
  open,
  onClose,
  title,
  children,
  choices,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  choices: Choice[];
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div
          className="grid w-full gap-2"
          style={{ gridTemplateColumns: `repeat(${choices.length > 2 ? 1 : choices.length}, 1fr)` }}
        >
          {choices.map((c) => (
            <Button
              key={c.label}
              variant="secondary"
              size="lg"
              onClick={c.onSelect}
              className="px-2"
            >
              {c.label}
            </Button>
          ))}
        </div>
      }
    >
      {children}
    </Modal>
  );
}
