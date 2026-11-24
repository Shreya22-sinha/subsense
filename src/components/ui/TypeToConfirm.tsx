import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { TextField } from './TextField';

const WORD = 'DELETE';

/** A destructive confirmation that only enables after typing DELETE (PRD 6.12). */
export function TypeToConfirm({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState('');
  const close = () => {
    setTyped('');
    onClose();
  };
  const ok = typed.trim() === WORD;

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <Button variant="secondary" size="lg" className="flex-1" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="lg"
            className="flex-1"
            disabled={!ok}
            onClick={() => {
              setTyped('');
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>{children}</div>
        <TextField
          label={`Type ${WORD} to confirm`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
        />
      </div>
    </Modal>
  );
}
