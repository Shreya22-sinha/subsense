import { useCallback } from 'react';
import { useDataStore } from '@/store/dataStore';
import { showToast } from '@/store/uiStore';

const UNDO_MS = 6000;

/** UI-level subscription actions that pair a store action with user feedback. */
export function useSubscriptionActions() {
  /** Delete with a 6-second Undo toast (PRD 6.6). */
  const deleteWithUndo = useCallback((id: string) => {
    const snapshot = useDataStore.getState().deleteSubscription(id);
    if (!snapshot) return;
    showToast(`${snapshot.sub.name} deleted`, {
      durationMs: UNDO_MS,
      action: {
        label: 'Undo',
        onClick: () => useDataStore.getState().restoreSubscription(snapshot),
      },
    });
  }, []);

  const pause = useCallback((id: string) => {
    useDataStore.getState().pauseSubscription(id);
    showToast('Paused. It no longer counts towards your total.');
  }, []);

  const resume = useCallback((id: string) => {
    useDataStore.getState().resumeSubscription(id);
    showToast('Resumed.');
  }, []);

  return { deleteWithUndo, pause, resume };
}
