import React, { useState } from 'react';

/**
 * Modern, resilient Avatar component with graceful image loading and fallback to initials.
 * Supports image URLs, base64 data URIs, local upload paths, and error handling.
 */
export const Avatar = ({
  src,
  name = '',
  firstName = '',
  lastName = '',
  size = 'md',
  shape = 'circle',
  className = '',
  fallbackGradient = 'bg-gradient-to-tr from-brand-600 to-brand-500 text-white',
  alt,
  ...props
}) => {
  const [imageError, setImageError] = useState(false);

  // Compute initials
  const resolvedName = (name || `${firstName || ''} ${lastName || ''}`).trim();
  const getInitials = () => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (resolvedName) {
      const parts = resolvedName.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return resolvedName.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const initials = getInitials();

  // Size mapping
  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-14 h-14 text-base font-bold',
    '2xl': 'w-20 h-20 text-xl font-bold',
    '3xl': 'w-24 h-24 text-2xl font-bold',
  }[size] || size;

  // Shape mapping
  const shapeClasses = {
    circle: 'rounded-full',
    rounded: 'rounded-xl',
    'rounded-2xl': 'rounded-2xl',
    'rounded-lg': 'rounded-lg',
  }[shape] || 'rounded-full';

  const hasValidSrc = Boolean(src && typeof src === 'string' && src.trim().length > 0 && !imageError);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden font-semibold select-none shadow-xs ${shapeClasses} ${sizeClasses} ${
        hasValidSrc ? 'bg-slate-100' : fallbackGradient
      } ${className}`}
      {...props}
    >
      {hasValidSrc ? (
        <img
          src={src}
          alt={alt || resolvedName || 'User Avatar'}
          onError={() => setImageError(true)}
          className={`w-full h-full object-cover ${shapeClasses}`}
          loading="lazy"
        />
      ) : (
        <span className="leading-none">{initials}</span>
      )}
    </div>
  );
};

export default Avatar;
