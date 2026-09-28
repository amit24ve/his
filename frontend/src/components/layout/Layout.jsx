import React, { useState, useEffect, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import PageWatermark from './PageWatermark';
import FollowUpNotifications from '../notifications/FollowUpNotifications';
import AllFollowUpsModal from '../reminders/AllFollowUpsModal';
import { initializeAudio } from '../../utils/soundUtils';

const Layout = ({ logout }) => { // <-- Accept logout as a prop
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [currentUser, setCurrentUser] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userId, setUserId] = useState("");
  const [showAllFollowUps, setShowAllFollowUps] = useState(false);

  // Detect screen width and manage sidebar
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        const storedState = localStorage.getItem('sidebarOpen');
        setSidebarOpen(storedState === 'true' || storedState === null);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user.username || user.name || "");
        setUserRole(user.role || user.roles?.[0] || "");
        setUserId(user.user_id || user.id || "");
      } catch (e) {
        console.error("Invalid user object in localStorage");
      }
    }
    
    // Initialize audio context for notifications
    initializeAudio();
  }, []);

  // Listen for global event to open all followups modal
  useEffect(() => {
    const handleOpenAllFollowUps = () => {
      setShowAllFollowUps(true);
    };

    window.addEventListener('openAllFollowUps', handleOpenAllFollowUps);
    return () => window.removeEventListener('openAllFollowUps', handleOpenAllFollowUps);
  }, []);

  // Save sidebar state only (don't touch user here)
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem('sidebarOpen', sidebarOpen);
    }
  }, [sidebarOpen, isMobile]);

  const toggleSidebar = (value) => {
    setSidebarOpen(typeof value === 'boolean' ? value : !sidebarOpen);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 text-gray-900">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} isMobile={isMobile} />

      {/* Main content area - adjusts width based on sidebar state */}
      <div 
        className={`flex flex-col h-screen overflow-hidden transition-all duration-300 ease-in-out ${
          isMobile 
            ? 'flex-1' // On mobile, always full width
            : sidebarOpen 
              ? 'flex-1' // On desktop with sidebar open, use remaining space
              : 'flex-1' // On desktop with sidebar closed, use remaining space
        }`}
      >
        <TopHeader
          toggleSidebar={toggleSidebar}
          currentDateTime={new Date().toLocaleString()}
          currentUser={currentUser}
          logout={logout}
        />

        <main 
          className={`flex-1 overflow-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 transition-all duration-300 ease-in-out ${
            isMobile ? 'w-full' : 'w-full max-w-none'
          }`}
          style={{ position: 'relative' }}
        >
          {/* Page-specific hospital watermark */}
          <PageWatermark />
          <div className={`${isMobile ? 'max-w-full' : 'max-w-screen-xl'} mx-auto w-full`}>
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-gray-500">Loading...</span>
                </div>
              </div>
            }>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {/* Follow-up Notifications */}
      {userId && (
        <FollowUpNotifications 
          userId={userId} 
          userRole={userRole} 
        />
      )}

      {/* All Follow-ups Modal */}
      <AllFollowUpsModal
        isOpen={showAllFollowUps}
        onClose={() => setShowAllFollowUps(false)}
        userId={userId}
        userRole={userRole}
      />
    </div>
  );
};

export default Layout;