import React from 'react';

/**
 * Badge Component
 * 
 * @param {Object} props
 * @param {string} props.text - Text content of the badge
 * @param {string} props.type - Type of badge (primary, secondary, success, warning, danger, info, light, dark)
 * @param {string} props.size - Size of badge (sm, md, lg)
 * @param {boolean} props.pill - Whether badge should be rounded pill style
 * @param {boolean} props.notification - Whether badge is used as a notification indicator (no text, just a dot)
 * @param {string} props.className - Additional CSS classes
 * @param {React.ReactNode} props.children - Alternative to text prop
 */
const Badge = ({
  text,
  type = 'primary',
  size = 'md',
  pill = false,
  notification = false,
  className = '',
  children
}) => {
  // Map type to appropriate Tailwind classes
  const getTypeClasses = () => {
    switch (type) {
      case 'primary':
        return 'bg-blue-100 text-blue-600';
      case 'secondary':
        return 'bg-gray-100 text-gray-600';
      case 'success':
        return 'bg-green-100 text-green-600';
      case 'warning':
        return 'bg-yellow-100 text-yellow-600';
      case 'danger':
        return 'bg-red-100 text-red-600';
      case 'info':
        return 'bg-purple-100 text-purple-600';
      case 'light':
        return 'bg-gray-100 text-gray-500';
      case 'dark':
        return 'bg-gray-700 text-white';
      default:
        return 'bg-blue-100 text-blue-600';
    }
  };

  // Map size to Tailwind classes
  const getSizeClasses = () => {
    if (notification) {
      switch (size) {
        case 'sm': return 'w-2 h-2';
        case 'lg': return 'w-4 h-4';
        case 'md':
        default: return 'w-3 h-3';
      }
    } else {
      switch (size) {
        case 'sm': return 'text-xs py-0.5 px-1.5';
        case 'lg': return 'text-sm py-1 px-2.5';
        case 'md':
        default: return 'text-xs py-1 px-2';
      }
    }
  };

  const baseClasses = notification
    ? 'inline-block rounded-full'
    : 'inline-flex items-center justify-center font-medium';

  const pillClasses = pill || notification ? 'rounded-full' : 'rounded-md';

  const classes = `
    ${baseClasses}
    ${pillClasses}
    ${getTypeClasses()}
    ${getSizeClasses()}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return notification ? (
    <span className={classes}></span>
  ) : (
    <span className={classes}>
      {text || children}
    </span>
  );
};

export default Badge;