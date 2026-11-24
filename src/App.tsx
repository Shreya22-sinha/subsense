import type { CSSProperties } from 'react';
import { Outlet } from 'react-router';
import { DemoControlsPanel } from '@/components/demo/DemoControlsPanel';
import { SessionGate } from '@/components/layout/SessionGate';
import { PhoneFrame } from '@/components/layout/PhoneFrame';
import { StatusBar } from '@/components/layout/StatusBar';
import { ToastHost } from '@/components/ui/ToastHost';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { useIsDesktop } from '@/hooks/useViewport';
import { cn } from '@/lib/cn';
import { useDevice, useDeviceStore } from '@/store/deviceStore';

/** Root layout: phone frame + demo controls on desktop, full screen on mobile (PRD 5). */
export default function App() {
  const theme = useResolvedTheme();
  const desktop = useIsDesktop();
  const device = useDevice();
  const size = useDeviceStore((s) => s.size);

  return (
    <div
      className={cn(
        'min-h-dvh lg:flex lg:justify-center lg:gap-12 lg:bg-brand-gradient lg:p-6',
        size === 'fit' ? 'lg:items-center' : 'lg:items-start',
      )}
    >
      <PhoneFrame>
        <div
          className={cn(
            'app-root relative flex h-full flex-col bg-canvas text-ink',
            theme === 'dark' && 'dark',
          )}
          style={
            desktop ? ({ '--safe-bottom': `${device.safeBottom}px` } as CSSProperties) : undefined
          }
        >
          <StatusBar />
          <div className="min-h-0 flex-1">
            <SessionGate>
              <Outlet />
            </SessionGate>
          </div>
          <ToastHost />
          {/* Modals portal here so they stay inside the phone screen. */}
          <div id="overlay-root" />
          {desktop && device.safeBottom > 0 && (
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute bottom-2 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink',
                device.statusStyle === 'ios' ? 'h-[5px] w-[138px]' : 'h-[4px] w-[108px] opacity-70',
              )}
            />
          )}
        </div>
      </PhoneFrame>
      <DemoControlsPanel />
    </div>
  );
}
