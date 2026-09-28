import { useState, useEffect, useCallback } from 'react';

const REMINDERS_API = 'https://cubehis.avopay.pro:5000/api/followups';

export const useReminders = (userRole, userId) => {
  const [reminders, setReminders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchReminders = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      let url;
      if (userRole === 'admin') {
        // Admin sees all reminders
        url = `${REMINDERS_API}/reminders/all/admin?window_minutes=10`;
      } else {
        // Regular users see only their assigned reminders
        url = `${REMINDERS_API}/reminders/${userId}?window_minutes=10`;
      }

      const response = await fetch(url, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setReminders(Array.isArray(data) ? data : []);

      // Show modal if there are reminders
      if (Array.isArray(data) && data.length > 0) {
        setShowModal(true);
      }

    } catch (err) {
      console.error('Error fetching reminders:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userRole, userId]);

  const markReminderAsSent = async (reminderId) => {
    try {
      const response = await fetch(`${REMINDERS_API}/${reminderId}/mark-sent`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Remove the reminder from the list
      setReminders(prev => prev.filter(r => r.id !== reminderId));

      // If no more reminders, hide the modal
      setReminders(prev => {
        if (prev.length === 0) {
          setShowModal(false);
        }
        return prev;
      });

    } catch (err) {
      console.error('Error marking reminder as sent:', err);
      throw err;
    }
  };

  const hideModal = () => {
    setShowModal(false);
  };

  const showModalManually = () => {
    setShowModal(true);
  };

  // Poll for reminders every 2 minutes
  useEffect(() => {
    if (!userId) return;

    // Initial fetch
    fetchReminders();

    // Set up polling
    const interval = setInterval(fetchReminders, 2 * 60 * 1000); // 2 minutes

    return () => clearInterval(interval);
  }, [fetchReminders, userId]);

  return {
    reminders,
    isLoading,
    error,
    showModal,
    fetchReminders,
    markReminderAsSent,
    hideModal,
    showModalManually
  };
};

export default useReminders;
