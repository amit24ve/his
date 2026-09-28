import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * UserDropdown Component
 * Displays the current user with a dropdown menu for profile, settings, and logout
 * 
 * @param {Object} props
 * @param {string} props.username - Username to display
 * @param {string} props.avatar - URL to user's avatar image
 * @param {Function} props.onLogout - Function to call when logout is clicked
 */
const UserDropdown = ({ 
  username = 'amit24ve', 
  avatar = '/assets/images/avatar.png',
  onLogout = () => console.log('Logout clicked') 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Format current datetime - this would typically be dynamic
  const currentDateTime = '2025-06-04 10:07:02';
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Toggle dropdown visibility
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };
  
  return (
    <div className="relative" ref={dropdownRef}>
      {/* User info and dropdown toggle */}
      <div 
        className="flex items-center cursor-pointer" 
        onClick={toggleDropdown}
      >
        <div className="mr-3 text-right hidden md:block">
          <div className="text-sm font-medium">{username}</div>
          <div className="text-xs text-text-secondary">{currentDateTime}</div>
        </div>
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-gray-200 overflow-hidden">
            <img 
              src={avatar} 
              alt={`${username}'s avatar`} 
              className="h-full w-full object-cover"
              onError={(e) => {
                // Fallback to initials if image fails to load
                e.target.style.display = 'none';
                e.target.parentNode.innerHTML = username.charAt(0).toUpperCase();
                e.target.parentNode.style.display = 'flex';
                e.target.parentNode.style.alignItems = 'center';
                e.target.parentNode.style.justifyContent = 'center';
                e.target.parentNode.style.backgroundColor = '#6366F1';
                e.target.parentNode.style.color = 'white';
                e.target.parentNode.style.fontWeight = 'bold';
              }}
            />
          </div>
          <i className={`fas fa-chevron-down ml-2 text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
        </div>
      </div>
      
      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-light">
          {/* User info (mobile only) */}
          <div className="px-4 py-2 border-b border-light md:hidden">
            <div className="text-sm font-medium">{username}</div>
            <div className="text-xs text-text-secondary">{currentDateTime}</div>
          </div>
          
          {/* Menu items */}
          <Link to="/profile" className="block px-4 py-2 text-sm text-text-primary hover:bg-light" onClick={() => setIsOpen(false)}>
            <i className="fas fa-user mr-2 text-text-secondary w-5 text-center"></i> Profile
          </Link>
          <Link to="/settings" className="block px-4 py-2 text-sm text-text-primary hover:bg-light" onClick={() => setIsOpen(false)}>
            <i className="fas fa-cog mr-2 text-text-secondary w-5 text-center"></i> Settings
          </Link>
          <Link to="/help" className="block px-4 py-2 text-sm text-text-primary hover:bg-light" onClick={() => setIsOpen(false)}>
            <i className="fas fa-question-circle mr-2 text-text-secondary w-5 text-center"></i> Help
          </Link>
          
          {/* Divider */}
          <div className="border-t border-light my-1"></div>
          
          {/* Logout */}
          <button 
            className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-light"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
          >
            <i className="fas fa-sign-out-alt mr-2 text-text-secondary w-5 text-center"></i> Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default UserDropdown;