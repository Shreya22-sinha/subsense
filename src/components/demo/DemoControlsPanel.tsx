import { FlaskConical } from 'lucide-react';
import { DemoTools } from './DemoTools';
import { DevicePicker } from './DevicePicker';

/** Desktop side panel beside the phone frame (1024 px and wider). Always light. */
export function DemoControlsPanel() {
  return (
    <aside
      aria-label="Demo controls"
      className="app-root scrollbar-thin sticky top-6 hidden max-h-[calc(100dvh-3rem)] w-[340px] shrink-0 flex-col overflow-y-auto rounded-3xl bg-surface/95 p-6 text-ink shadow-2xl backdrop-blur lg:flex"
    >
      <div className="mb-5 flex items-center gap-2">
        <FlaskConical size={20} className="text-brand-ink" aria-hidden />
        <h2 className="text-lg font-semibold">Demo controls</h2>
      </div>
      <div className="mb-5">
        <DevicePicker />
      </div>
      <DemoTools />
      <p className="mt-6 text-xs text-ink-muted">Portfolio project. Not financial advice.</p>
    </aside>
  );
}
