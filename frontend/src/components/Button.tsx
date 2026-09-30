import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export function Button({ variant = 'primary', className = '', ...rest }: ButtonProps) {
  const base =
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-7 py-3 font-body text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-70';
  const styles =
    variant === 'primary'
      ? 'bg-primary text-white hover:bg-primary-dark disabled:hover:bg-primary'
      : 'border border-primary bg-transparent text-primary';
  return <button type="button" className={`${base} ${styles} ${className}`} {...rest} />;
}
