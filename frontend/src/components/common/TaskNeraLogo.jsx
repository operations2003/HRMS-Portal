import React, { useState } from 'react';

/**
 * TaskNera Official Brand Logo Component
 * 
 * Props:
 * - variant: 'full' (emblem + wordmark + tagline) | 'icon' (just emblem) | 'horizontal' (compact lockup)
 * - size: 'sm' | 'md' | 'lg' | 'xl'
 * - showText: boolean (for 'icon' variant)
 * - showSubtitle: boolean
 * - className: string
 * - alt: string
 */
export const TaskNeraLogo = ({
  variant = 'full',
  size = 'md',
  showText = false,
  showSubtitle = true,
  className = '',
  alt = 'TaskNera',
}) => {
  // Scalable SVG for the TaskNera Official Emblem in Royal Indigo & Slate
  const renderEmblem = (sizeClasses = 'w-12 h-12') => {
    return (
      <svg
        viewBox="0 0 100 100"
        className={`${sizeClasses} shrink-0 drop-shadow-sm transition-transform duration-200 hover:scale-105`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="TaskNera Icon"
      >
        <defs>
          <linearGradient id="tnIndigo" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#4338CA" />
          </linearGradient>
          <linearGradient id="tnSlate" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
        </defs>
        {/* Top curved horizontal bar */}
        <path
          d="M10 8 C10 8, 30 8, 88 8 C92 8, 94 10, 92 14 L78 32 C77 34, 75 35, 72 35 L26 35 C17 35, 10 28, 10 19 Z"
          fill="url(#tnIndigo)"
        />
        {/* Left rounded vertical stem */}
        <path
          d="M20 38 C29 38, 48 38, 48 38 C49 38, 49 39, 48 41 L40 54 C39 56, 38 58, 38 61 L38 92 C38 95, 35 97, 32 97 L24 97 C20 97, 17 94, 17 90 L17 48 C17 42, 20 38, 20 38 Z"
          fill="url(#tnSlate)"
        />
        {/* Right angled checkmark */}
        <path
          d="M48 64 C47 62, 49 59, 52 61 L61 68 C63 70, 66 69, 68 67 L95 38 C97 36, 100 37, 99 40 L73 89 C70 94, 63 94, 60 90 L48 64 Z"
          fill="url(#tnIndigo)"
        />
      </svg>
    );
  };

  // 1. Icon Only
  if (variant === 'icon') {
    const iconSizes = {
      sm: 'w-7 h-7',
      md: 'w-9 h-9',
      lg: 'w-12 h-12',
      xl: 'w-16 h-16',
    };
    return (
      <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
        {renderEmblem(iconSizes[size] || iconSizes.md)}
        {showText && (
          <div className="flex flex-col">
            <div className="flex items-center text-lg font-black tracking-tight leading-none">
              <span className="text-slate-900">Task</span>
              <span className="text-brand-500">Nera</span>
            </div>
            {showSubtitle && (
              <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">
                HRMS Portal
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // 2. Full Brand Lockup: Emblem on Left + Wordmark and Tagline on Right
  const lockupSizes = {
    sm: {
      emblem: 'w-8 h-8',
      title: 'text-xl',
      tagline: 'text-[10px]',
      gap: 'gap-2.5',
    },
    md: {
      emblem: 'w-12 h-12 sm:w-14 sm:h-14',
      title: 'text-3xl sm:text-4xl',
      tagline: 'text-xs sm:text-sm',
      gap: 'gap-3.5',
    },
    lg: {
      emblem: 'w-16 h-16 sm:w-20 sm:h-20',
      title: 'text-4xl sm:text-5xl',
      tagline: 'text-sm sm:text-base',
      gap: 'gap-4',
    },
  };

  const currentSize = lockupSizes[size] || lockupSizes.md;

  return (
    <div className={`inline-flex items-center ${currentSize.gap} select-none ${className}`}>
      {/* Official Emblem */}
      {renderEmblem(currentSize.emblem)}

      {/* Wordmark and Tagline */}
      <div className="flex flex-col text-left">
        <div className={`flex items-center ${currentSize.title} font-black tracking-tight leading-none`}>
          <span className="text-slate-900">Task</span>
          <span className="text-brand-500">Nera</span>
        </div>
        {showSubtitle && (
          <p className={`${currentSize.tagline} text-slate-500 font-medium tracking-tight mt-1 sm:mt-1.5`}>
            People. Processes. Performance.
          </p>
        )}
      </div>
    </div>
  );
};
