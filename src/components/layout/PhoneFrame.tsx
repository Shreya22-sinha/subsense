import type { CSSProperties, ReactNode } from 'react';
import { bodySize, type Device } from '@/data/devices';
import { useIsDesktop, useWindowHeight } from '@/hooks/useViewport';
import { cn } from '@/lib/cn';
import { useDevice, useDeviceStore } from '@/store/deviceStore';

/** Room kept above and below the phone when it is fitted to the window. */
const MARGIN = 48;

function Cutout({ device }: { device: Device }) {
  if (device.cutout === 'island') {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute top-[11px] left-1/2 z-[70] h-[36px] w-[124px] -translate-x-1/2 rounded-full bg-black"
      >
        <span className="absolute top-1/2 right-[10px] size-[13px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_40%_35%,#2b3a5c_0%,#10141f_55%,#050609_100%)]" />
      </div>
    );
  }
  if (device.cutout === 'punch') {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 z-[70] size-[22px] -translate-x-1/2 rounded-full bg-black"
        style={{ top: (device.statusBar - 22) / 2 + 2 }}
      >
        <span className="absolute inset-[6px] rounded-full bg-[radial-gradient(circle_at_40%_35%,#2b3a5c_0%,#10141f_60%,#050609_100%)]" />
      </div>
    );
  }
  return null;
}

/**
 * 1024 px and wider: a realistic phone body (metal edge, glass bezel, camera cutout, side
 * buttons) around a screen of the chosen phone's real size. "Fit" scales the whole phone down
 * on short windows so its proportions stay true. Below 1024 px the app fills the screen.
 * The element structure is the same in both cases, so resizing never remounts the app.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  const desktop = useIsDesktop();
  const windowHeight = useWindowHeight();
  const device = useDevice();
  const size = useDeviceStore((s) => s.size);

  const body = bodySize(device);
  const scale = size === 'fit' ? Math.min(1, (windowHeight - MARGIN) / body.height) : 1;
  const [light, mid, dark] = device.metal;
  const glassRadius = device.homeButton ? 52 : device.radius + device.bezel.side;
  const bodyRadius = glassRadius + device.edge;

  const outer: CSSProperties | undefined = desktop
    ? { width: body.width * scale, height: body.height * scale }
    : undefined;
  const shell: CSSProperties | undefined = desktop
    ? {
        width: body.width,
        height: body.height,
        padding: device.edge,
        borderRadius: bodyRadius,
        background: `linear-gradient(135deg, ${light} 0%, ${dark} 22%, ${mid} 48%, ${dark} 78%, ${light} 100%)`,
        boxShadow:
          '0 40px 80px -20px rgb(8 6 30 / 0.55), 0 12px 28px rgb(8 6 30 / 0.35), inset 0 0 2px rgb(255 255 255 / 0.7)',
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: 'top left',
      }
    : undefined;
  const glass: CSSProperties | undefined = desktop
    ? {
        padding: `${device.bezel.top}px ${device.bezel.side}px ${device.bezel.bottom}px`,
        borderRadius: glassRadius,
        background: '#060608',
        boxShadow: 'inset 0 0 0 1.5px #24252a',
      }
    : undefined;

  return (
    <div className="h-dvh w-full lg:h-auto lg:w-auto lg:shrink-0" style={outer}>
      <div className="relative h-full w-full" style={shell}>
        {desktop &&
          device.buttons.map((b) => (
            <span
              key={`${b.side}-${b.top}`}
              aria-hidden
              className={cn(
                'absolute w-[4px]',
                b.side === 'left' ? 'rounded-l-sm' : 'rounded-r-sm',
              )}
              style={{
                [b.side]: -3,
                top: b.top,
                height: b.length,
                background: `linear-gradient(180deg, ${dark} 0%, ${light} 10%, ${mid} 50%, ${light} 90%, ${dark} 100%)`,
              }}
            />
          ))}

        <div className="relative h-full w-full" style={glass}>
          {desktop && device.homeButton && (
            <>
              {/* Earpiece, front camera and home button of older phones. */}
              <span
                aria-hidden
                className="absolute top-[44px] left-1/2 h-[6px] w-[62px] -translate-x-1/2 rounded-full bg-[#1c1d21]"
              />
              <span
                aria-hidden
                className="absolute top-[41px] left-[calc(50%-62px)] size-[12px] rounded-full bg-[radial-gradient(circle_at_40%_35%,#2b3a5c_0%,#10141f_60%)]"
              />
              <span
                aria-hidden
                className="absolute bottom-[18px] left-1/2 size-[60px] -translate-x-1/2 rounded-full border-[3px] border-[#34363c] bg-[#0b0b0e]"
              />
            </>
          )}
          <div
            className="relative h-full w-full overflow-hidden"
            style={desktop ? { borderRadius: device.radius } : undefined}
          >
            {children}
            {desktop && <Cutout device={device} />}
          </div>
        </div>
      </div>
    </div>
  );
}
