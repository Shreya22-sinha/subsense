import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

interface StyleProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-strong disabled:bg-brand/40',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2 disabled:text-ink-muted/60',
  ghost: 'bg-transparent text-brand-ink hover:bg-brand-soft disabled:text-ink-muted/60',
  danger: 'bg-surface text-danger-ink border border-danger/50 hover:bg-danger/10',
};

const SIZES: Record<Size, string> = {
  // 44 px minimum tap target (PRD 10).
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
};

function buttonClass({ variant = 'primary', size = 'md', fullWidth }: StyleProps, extra?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    extra,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & StyleProps;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fullWidth, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, fullWidth }, className)}
      {...rest}
    />
  );
});

/** A router link that looks like a Button. */
export function ButtonLink({
  variant,
  size,
  fullWidth,
  className,
  ...rest
}: LinkProps & StyleProps) {
  return <Link className={buttonClass({ variant, size, fullWidth }, className)} {...rest} />;
}
