import { Segmented } from '@/components/ui/Segmented';
import { bodySize, DEVICES, type Device } from '@/data/devices';
import { cn } from '@/lib/cn';
import { useDeviceStore, type FrameSize } from '@/store/deviceStore';

const TALLEST = Math.max(...DEVICES.map((d) => bodySize(d).height));

/** A small outline of the phone, to scale with the others. */
function Silhouette({ device, selected }: { device: Device; selected: boolean }) {
  const k = 46 / TALLEST;
  const body = bodySize(device);
  return (
    <span
      aria-hidden
      className={cn('relative block border-2', selected ? 'border-brand' : 'border-ink-muted')}
      style={{
        width: body.width * k,
        height: body.height * k,
        borderRadius: Math.max(2, (device.homeButton ? 52 : device.radius) * k),
      }}
    >
      {device.cutout !== 'none' && (
        <span
          className={cn(
            'absolute top-[2px] left-1/2 h-[2px] -translate-x-1/2 rounded-full',
            device.cutout === 'island' ? 'w-[7px]' : 'w-[2px]',
            selected ? 'bg-brand' : 'bg-ink-muted',
          )}
        />
      )}
      {device.homeButton && (
        <span
          className={cn(
            'absolute bottom-px left-1/2 size-[4px] -translate-x-1/2 rounded-full',
            selected ? 'bg-brand' : 'bg-ink-muted',
          )}
        />
      )}
    </span>
  );
}

/** Choose which phone the frame imitates, and whether it is fitted to the window. */
export function DevicePicker() {
  const { deviceId, size, setDevice, setSize } = useDeviceStore();

  return (
    <section aria-labelledby="demo-phone">
      <h3
        id="demo-phone"
        className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase"
      >
        Phone
      </h3>
      <div role="radiogroup" aria-labelledby="demo-phone" className="grid grid-cols-4 gap-1.5">
        {DEVICES.map((d) => {
          const selected = d.id === deviceId;
          return (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setDevice(d.id)}
              className={cn(
                'flex min-h-[92px] flex-col items-center justify-end gap-1.5 rounded-xl border px-1 py-2 text-center text-[11px] leading-tight font-medium',
                selected
                  ? 'border-brand bg-brand-soft text-brand-ink'
                  : 'border-line bg-surface text-ink hover:border-brand/50',
              )}
            >
              <Silhouette device={d} selected={selected} />
              <span className="flex min-h-[26px] items-center">{d.name}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2">
        <Segmented<FrameSize>
          label="Phone size"
          value={size}
          onChange={setSize}
          options={[
            { value: 'fit', label: 'Fit to window' },
            { value: 'actual', label: 'Actual size' },
          ]}
        />
      </div>
    </section>
  );
}
