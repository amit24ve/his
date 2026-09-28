import React, { useEffect, useState } from 'react';

const NotificationToast = ({ 
  type = 'info', 
  message, 
  duration = 5000, 
  onClose,
  position = 'top-right'
}) => {
  const [visible, setVisible] = useState(true);
  
  // Get position classes
  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-5 left-5';
      case 'top-center':
        return 'top-5 left-1/2 -translate-x-1/2';
      case 'bottom-right':
        return 'bottom-5 right-5';
      case 'bottom-left':
        return 'bottom-5 left-5';
      case 'bottom-center':
        return 'bottom-5 left-1/2 -translate-x-1/2';
      case 'top-right':
      default:
        return 'top-5 right-5';
    }
  };
  
  // Don't show toast if message is empty
  if (!message) return null;
  
  // Auto-close notification after duration
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose && onClose(), 300); // Wait for animation before calling onClose
    }, duration);
    
    return () => clearTimeout(timer);
  }, [duration, onClose, message]);
  
  // Handle manual close
  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose && onClose(), 300); // Wait for animation before calling onClose
  };
  
  // Get styles based on notification type
  const getStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-100',
          border: 'border-green-500',
          icon: 'fa-check-circle text-green-500'
        };
      case 'error':
        return {
          bg: 'bg-red-100',
          border: 'border-red-500',
          icon: 'fa-exclamation-circle text-red-500'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-100',
          border: 'border-yellow-500',
          icon: 'fa-exclamation-triangle text-yellow-500'
        };
      default:
        return {
          bg: 'bg-blue-100',
          border: 'border-blue-500',
          icon: 'fa-info-circle text-blue-500'
        };
    }
  };
  
  const styles = getStyles();
  
  return (
    <div 
      role="alert"
      aria-live="assertive"
      className={`fixed ${getPositionClasses()} z-50 max-w-sm transform transition-all duration-300 ${
        visible 
          ? 'translate-x-0 opacity-100' 
          : position.includes('left') 
            ? '-translate-x-full opacity-0' 
            : 'translate-x-full opacity-0'
      }`}
    >
      <div className={`${styles.bg} border-l-4 ${styles.border} p-4 rounded-md shadow-lg flex items-start`}>
        <div className="flex-shrink-0" aria-hidden="true">
          <i className={`fas ${styles.icon} text-lg`}></i>
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm">{message}</p>
        </div>
        <button 
          onClick={handleClose}
          className="ml-auto flex-shrink-0 text-gray-400 hover:text-gray-600 transition"
          aria-label="Close notification"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>
    </div>
  );
};

export default NotificationToast;
