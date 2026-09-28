// This file provides instructions on how to update all HTTP API endpoints to HTTPS

// 1. Import the config.js in your component files:
import { AUTH_API, LEAD_API, USER_API, ROLE_API, FOLLOWUP_API, ASSIGNED_LEADS_API } from '../config';

// 2. Replace hardcoded URLs with the imported constants:

// Instead of:
// fetch("https://cubehis.avopay.pro:5000/api/auth/login", {...})
// Use:
// fetch(AUTH_API.LOGIN, {...})

// Instead of:
// const API_BASE_URL = 'https://cubehis.avopay.pro:5000/api/lead';
// Use:
// const API_BASE_URL = LEAD_API.BASE;

// Instead of:
// axios.get('https://cubehis.avopay.pro:5000/api/roles/', {...})
// Use:
// axios.get(ROLE_API.ROLES, {...})

// This approach centralizes all API URLs in the config.js file,
// making it easier to change the domain, protocol, or API paths in the future.
