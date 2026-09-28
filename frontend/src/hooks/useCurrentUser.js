/**
 * useCurrentUser — Shared hook to access logged-in user's context.
 *
 * Reads from localStorage['user'] which is set at login time.
 * Returns:
 *   user         — raw user object
 *   isAdmin      — true if roles include 'admin'
 *   hospital_id  — current user's hospital id (empty string for admin)
 *   hospital_name— current user's hospital name
 *   headers      — standard Authorization headers for fetch calls
 */
import { useMemo } from 'react';

export function useCurrentUser() {
  const user = useMemo(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);

  const roles = Array.isArray(user.roles) ? user.roles : [];
  const isAdmin = roles.includes('admin');
  const hospital_id = user.hospital_id || '';
  const hospital_name = user.hospital_name || '';

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
  };

  return { user, isAdmin, hospital_id, hospital_name, headers, roles };
}
