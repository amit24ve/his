/**
 * Utility functions for date formatting and manipulation
 */

/**
 * Format a date string to a more readable format
 * @param {string} dateString - Date string in ISO format (YYYY-MM-DD)
 * @param {string} locale - Locale for date formatting (default: 'en-US')
 * @returns {string} Formatted date string
 */
export const formatDate = (dateString, locale = 'en-US') => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString;
    }
    
    // Format date as DD/MM/YYYY
    return date.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
};

/**
 * Format a date and time string to a readable format
 * @param {string} dateTimeString - Date and time string
 * @param {string} locale - Locale for date formatting (default: 'en-US')
 * @returns {string} Formatted date and time string
 */
export const formatDateTime = (dateTimeString, locale = 'en-US') => {
  if (!dateTimeString) return '';
  
  try {
    const date = new Date(dateTimeString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateTimeString;
    }
    
    // Format date as DD/MM/YYYY HH:MM
    return date.toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return dateTimeString;
  }
};

/**
 * Calculate the difference in days between two date strings
 * @param {string} startDate - Start date in any valid date format
 * @param {string} endDate - End date in any valid date format
 * @returns {number} Number of days between the dates
 */
export const getDaysDifference = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 0;
    }
    
    // Calculate difference in days
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays + 1; // Include both start and end days
  } catch (error) {
    console.error('Error calculating days difference:', error);
    return 0;
  }
};
