import React from 'react';

/**
 * Button Component
 * 
 * @param {Object} props
 * @param {string} props.type - Type of button (primary, secondary, success, warning, danger, light)
 * @param {string} props.size - Size of button (sm, md, lg)
 * @param {string} props.variant - Variant style (solid, outline)
 * @param {boolean} props.fullWidth - Whether button should take full width
 * @param {boolean} props.disabled - Whether button is disabled
 * @param {React.ReactNode} props.leftIcon - Icon to display on the left
 * @param {React.ReactNode} props.rightIcon - Icon to display on the right
 * @param {string} props.className - Additional CSS classes
 * @param {Function} props.onClick - Click handler function
 * @param {string} props.buttonType - HTML button type (button, submit, reset)
 * @param {React.ReactNode} props.children - Button content
 */
const Button = ({
  type = 'primary',
  size = 'md',
  variant = 'solid',
  fullWidth = false,
  disabled = false,
  leftIcon,
  rightIcon,
  className = '',
  onClick,
  buttonType = 'button',
  children,
  ...rest
}) => {
  // Map button type to appropriate Tailwind classes
  const getTypeClasses = () => {
    if (variant === 'solid') {
      switch (type) {
        case 'primary':
          return 'bg-secondary text-white hover:bg-blue-700 focus:ring-blue-200';
        case 'success':
          return 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-200';
        case 'warning':
          return 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-200';
        case 'danger':
          return 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-200';
        case 'light':
          return 'bg-light text-text-primary hover:bg-muted hover:text-white focus:ring-gray-200';
        case 'secondary':
        default:
          return 'bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-200';
      }
    } else {
      switch (type) {
        case 'primary':
          return 'bg-transparent text-secondary border border-secondary hover:bg-blue-50 focus:ring-blue-200';
        case 'success':
          return 'bg-transparent text-green-600 border border-green-500 hover:bg-green-50 focus:ring-green-200';
        case 'warning':
          return 'bg-transparent text-yellow-600 border border-yellow-500 hover:bg-yellow-50 focus:ring-yellow-200';
        case 'danger':
          return 'bg-transparent text-red-600 border border-red-500 hover:bg-red-50 focus:ring-red-200';
        case 'light':
          return 'bg-transparent text-gray-600 border border-gray-300 hover:bg-gray-50 focus:ring-gray-200';
        case 'secondary':
        default:
          return 'bg-transparent text-gray-600 border border-gray-500 hover:bg-gray-50 focus:ring-gray-200';
      }
    }
  };

  // Map size to Tailwind classes
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'py-sm px-md text-sm';
      case 'lg':
        return 'py-md px-lg text-base';
      case 'md':
      default:
        return 'py-sm px-md text-sm';
    }
  };

  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-opacity-50';
  
  const widthClasses = fullWidth ? 'w-full' : '';
  
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';
  
  const classes = `
    ${baseClasses}
    ${getTypeClasses()}
    ${getSizeClasses()}
    ${widthClasses}
    ${disabledClasses}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <button
      type={buttonType}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
};

export default Button;