/**
 * Address Utility Functions
 * 
 * Provides functions for fetching location data based on pincode or state
 */

/**
 * Fetch state information based on pincode
 * @param {string} pincode - 6-digit pincode
 * @returns {Promise<object>} State and other location info
 */
export const fetchStateByPincode = async (pincode) => {
  try {
    // Using India Post API for pincode lookup
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await response.json();
    
    if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
      const postOffice = data[0].PostOffice[0];
      
      return {
        state: postOffice.State,
        district: postOffice.District,
        city: postOffice.Block || postOffice.Name
      };
    }
    
    throw new Error('Invalid pincode or location not found');
  } catch (error) {
    console.error('Error fetching state by pincode:', error);
    return null;
  }
};

/**
 * Fetch list of cities in a state
 * @param {string} state - State name
 * @returns {Promise<string[]>} Array of city names
 */
export const fetchCities = async (state) => {
  try {
    // This is a simplified implementation - in a real app, you'd use a more comprehensive API
    // For now, we'll return a hardcoded list of cities based on state
    const stateCities = {
      'Andhra Pradesh': ['Vijayawada', 'Visakhapatnam', 'Guntur', 'Nellore', 'Kurnool'],
      'Karnataka': ['Bangalore', 'Mysore', 'Hubli', 'Mangalore', 'Belgaum'],
      'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Tiruchirapalli'],
      'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam'],
      'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik'],
      'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar'],
      'Delhi': ['New Delhi', 'Delhi', 'Noida', 'Gurgaon', 'Faridabad'],
      'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Ghaziabad', 'Agra', 'Varanasi'],
      'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'],
      'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri'],
      'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam']
    };
    
    return stateCities[state] || [];
  } catch (error) {
    console.error('Error fetching cities:', error);
    return [];
  }
};

/**
 * Validate Indian pincode format
 * @param {string} pincode - Pincode to validate
 * @returns {boolean} Whether the pincode is valid
 */
export const validatePincode = (pincode) => {
  // Indian pincodes are 6 digits
  const pincodeRegex = /^[1-9][0-9]{5}$/;
  return pincodeRegex.test(pincode);
};

/**
 * Format address for display
 * @param {object} address - Address object with components
 * @returns {string} Formatted address string
 */
export const formatAddress = (address) => {
  const parts = [];
  
  if (address.street) parts.push(address.street);
  if (address.area) parts.push(address.area);
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.pincode) parts.push(address.pincode);
  
  return parts.join(', ');
};
