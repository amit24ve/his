/**
 * Timezone utilities for consistent IST handling in the frontend
 * All datetime operations should use these utilities to ensure proper IST timezone handling
 */

/**
 * Get current time in Indian Standard Time
 * @returns {Date} Current IST time as Date object
 */
export function getCurrentISTTime() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

/**
 * Get current IST timestamp in ISO format with timezone offset
 * @returns {string} ISO format string with IST timezone (+05:30)
 */
export function getCurrentISTTimestamp() {
  const istTime = getCurrentISTTime();
  
  // Create properly formatted ISO string with IST offset
  const year = istTime.getFullYear();
  const month = String(istTime.getMonth() + 1).padStart(2, '0');
  const day = String(istTime.getDate()).padStart(2, '0');
  const hours = String(istTime.getHours()).padStart(2, '0');
  const minutes = String(istTime.getMinutes()).padStart(2, '0');
  const seconds = String(istTime.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:30`;
}

/**
 * Convert any date to IST timezone
 * @param {string|Date|null} dateInput - Date string, Date object, or null
 * @returns {Date|null} Date object in IST timezone or null
 */
export function convertToIST(dateInput) {
  if (!dateInput) return null;
  
  let date;
  if (typeof dateInput === 'string') {
    date = new Date(dateInput);
  } else {
    date = new Date(dateInput);
  }
  
  if (isNaN(date.getTime())) return null;
  
  // Convert to IST timezone
  return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

/**
 * Format date in IST timezone
 * @param {string|Date|null} dateStr - Date string or Date object
 * @returns {string} Formatted date string or empty string
 */
export function formatDate(dateStr) {
  if (!dateStr) return "";
  
  const istDate = convertToIST(dateStr);
  if (!istDate) return dateStr;
  
  return istDate.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Format datetime in IST timezone with full precision
 * @param {string|Date|null} dateStr - Date string or Date object
 * @returns {string} Formatted datetime string or empty string
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return "";
  
  const istDate = convertToIST(dateStr);
  if (!istDate) return dateStr;
  
  return istDate.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

/**
 * Get current IST time formatted for datetime-local input
 * @returns {string} Formatted string for datetime-local input (YYYY-MM-DDTHH:MM)
 */
export function getCurrentISTForInput() {
  const istTime = getCurrentISTTime();
  
  const year = istTime.getFullYear();
  const month = String(istTime.getMonth() + 1).padStart(2, '0');
  const day = String(istTime.getDate()).padStart(2, '0');
  const hours = String(istTime.getHours()).padStart(2, '0');
  const minutes = String(istTime.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Parse date string to IST Date object
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date} Date object at start of day in IST
 */
export function parseDateToIST(dateStr) {
  const parsed = new Date(dateStr + 'T00:00:00');
  return convertToIST(parsed);
}

/**
 * Ensure consistent IST timezone handling for date comparisons
 * @param {string|Date} date1 - First date
 * @param {string|Date} date2 - Second date
 * @returns {boolean} True if dates are equal in IST timezone
 */
export function isDatesEqualInIST(date1, date2) {
  const ist1 = convertToIST(date1);
  const ist2 = convertToIST(date2);
  
  if (!ist1 || !ist2) return false;
  
  return ist1.getTime() === ist2.getTime();
}

/**
 * Get timezone offset string for IST
 * @returns {string} '+05:30'
 */
export function getISTOffset() {
  return '+05:30';
}

/**
 * Check if a date string includes timezone info
 * @param {string} dateStr - Date string to check
 * @returns {boolean} True if timezone info is present
 */
export function hasTimezoneInfo(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  return dateStr.includes('+') || dateStr.includes('Z') || dateStr.includes('-');
}

/**
 * Add IST timezone to a date string if it doesn't have timezone info
 * @param {string} dateStr - Date string
 * @returns {string} Date string with IST timezone
 */
export function ensureISTTimezone(dateStr) {
  if (!dateStr) return dateStr;
  if (hasTimezoneInfo(dateStr)) return dateStr;
  
  // Add IST timezone if missing
  return dateStr + '+05:30';
}
