import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface BadgeProps {
  children: ReactNode;
  variant?: 'neutral' | 'breaking';
  color?: string;
  className?: string;
}

export function Badge({
  children,
  variant = 'neutral',
  color,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'badge',
        variant === 'breaking' ? 'badge-breaking' : 'badge-neutral',
        className,
      )}
      style={
        color
          ? { backgroundColor: `${color}1f`, color }
          : undefined
      }
    >
      {children}
    </span>
  );
}
