import React from 'react';
import { cn } from '../lib/utils';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ children, content, className, position = 'top' }: TooltipProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="group relative inline-flex items-center justify-center">
      {children}
      <div className={cn(
        "absolute px-2.5 py-1.5 bg-zinc-800 text-xs font-medium text-zinc-200 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-white/10 shadow-xl",
        positionClasses[position],
        className
      )}>
        {content}
      </div>
    </div>
  );
}
