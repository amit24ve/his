import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Haversine distance calculation function
function haversineDistance(lat1, lon1, lat2, lon2) {
  function toRad(x) {
    return x * Math.PI / 180;
  }
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Office location and constants
const officeLocation = {
  geo_lat: 28.628747,
  geo_long: 77.381403,
};
const OFFICE_RADIUS_KM = 5;

// InfoModal component for notifications
function InfoModal({ open, onClose, title, message, status }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 relative">
        <button
          type="button"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="flex flex-col items-center mb-4">
          {status === "success" && (
            <svg className="w-12 h-12 text-green-500 mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M9 12l2 2l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          )}
          {status === "error" && (
            <svg className="w-12 h-12 text-red-500 mb-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" />
              <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {status === "info" && (
            <svg className="w-12 h-12 text-blue-500 mb-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" />
              <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">{title}</h3>
          <div className="text-gray-600 text-center whitespace-pre-line">{message}</div>
        </div>
        <button
          className="mt-4 w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-xl hover:bg-indigo-700 transition"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}

const HRStaffModuleComplete = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({});
  const [myAttendance, setMyAttendance] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState({ username: 'amit24', password: 'Amit@123' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const navigate = useNavigate();

  // Attendance modal and location states
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [geo, setGeo] = useState({ geo_lat: "", geo_long: "", accuracy: Infinity });
  const [geoError, setGeoError] = useState(false);
  const [geoAddress, setGeoAddress] = useState("");
  const [geoTime, setGeoTime] = useState("");
  const [locationReadings, setLocationReadings] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [infoModal, setInfoModal] = useState({
    open: false,
    title: "",
    message: "",
    status: "info"
  });

  // Login function
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      // Try multiple login endpoints
      const endpoints = [
        'https://cubehis.avopay.pro:5000/api/auth/login',
        'https://cubehis.avopay.pro:5000/auth/login',
        'https://cubehis.avopay.pro:5000/login'
      ];

      let loginSuccess = false;

      for (const endpoint of endpoints) {
        try {
          // Try form data format
          const formResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              username: loginCredentials.username,
              password: loginCredentials.password
            })
          });

          if (formResponse.ok) {
            const result = await formResponse.json();
            if (result.access_token) {
              localStorage.setItem('access_token', result.access_token);
              if (result.user) {
                localStorage.setItem('user', JSON.stringify(result.user));
              }
              setShowLogin(false);
              fetchCurrentUser();
              loginSuccess = true;
              break;
            }
          }

          // Try JSON format if form data fails
          if (!loginSuccess) {
            const jsonResponse = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                username: loginCredentials.username,
                password: loginCredentials.password
              })
            });

            if (jsonResponse.ok) {
              const result = await jsonResponse.json();
              if (result.access_token) {
                localStorage.setItem('access_token', result.access_token);
                if (result.user) {
                  localStorage.setItem('user', JSON.stringify(result.user));
                }
                setShowLogin(false);
                fetchCurrentUser();
                loginSuccess = true;
                break;
              }
            }
          }
        } catch (endpointError) {
          console.error(`Error with endpoint ${endpoint}:`, endpointError);
          continue;
        }
      }

      if (!loginSuccess) {
        setLoginError('Login failed. Please check your credentials or try again later.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Network error. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setCurrentUser(null);
    setShowLogin(true);
    setActiveTab('dashboard');
  };

  // Fetch current user data
  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setShowLogin(true);
        setLoading(false);
        return;
      }

      const response = await fetch('https://cubehis.avopay.pro:5000/api/employees/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.employee) {
          setCurrentUser({
            ...result.employee,
            roles: result.employee.role ? [result.employee.role] : [],
            id: result.employee.id || result.employee.employee_id
          });
          setShowLogin(false);
        } else {
          throw new Error('Invalid API response');
        }
      } else if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('access_token');
        setShowLogin(true);
      } else {
        throw new Error('API request failed');
      }
    } catch (error) {
      console.error('Error fetching user:', error);

      // Try fallback to localStorage
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setCurrentUser({
            id: user.user_id || user.id || user._id || 'unknown',
            employee_id: user.user_id || user.id || 'unknown',
            full_name: user.full_name || user.username || 'Unknown User',
            name: user.full_name || user.username || 'Unknown User',
            email: user.email || '',
            phone: user.phone || '',
            department: user.department || '',
            position: user.position || '',
            roles: user.roles || [],
            role: user.role || 'employee'
          });
          setShowLogin(false);
        } catch {
          setShowLogin(true);
        }
      } else {
        setShowLogin(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Check if user has specific permission
  const hasPermission = (permission) => {
    if (!currentUser || !currentUser.roles) return false;
    const roles = Array.isArray(currentUser.roles) ? currentUser.roles : [currentUser.roles];
    return roles.some(role =>
      typeof role === 'string'
        ? role.toLowerCase().includes('admin') || role.toLowerCase().includes('hr')
        : (role.name && (role.name.toLowerCase().includes('admin') || role.name.toLowerCase().includes('hr')))
    );
  };

  // Fetch dashboard statistics
  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch('https://cubehis.avopay.pro:5000/api/employees/dashboard-stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const stats = result.stats || result;
          setDashboardStats(stats);
        }
      } else if (response.status === 401) {
        setShowLogin(true);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  // Fetch employees list
  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch('https://cubehis.avopay.pro:5000/api/employees?page=1&limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setEmployees(result.employees || result.data || []);
        }
      } else if (response.status === 401) {
        setShowLogin(true);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  // Fetch my attendance records
  const fetchMyAttendance = async () => {
    if (!currentUser?.id) return;

    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch(`https://cubehis.avopay.pro:5000/api/employees/${currentUser.id}/attendance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setMyAttendance(result.records || result.data || []);
        }
      } else if (response.status === 401) {
        setShowLogin(true);
      }
    } catch (error) {
      console.error('Error fetching my attendance:', error);
    }
  };

  // Show the attendance modal
  const openAttendanceModal = () => {
    setShowAttendanceModal(true);
    // Reset location data
    setGeo({ geo_lat: "", geo_long: "", accuracy: Infinity });
    setGeoError(false);
    setGeoAddress("");
    setGeoTime("");
    setLocationReadings([]);
  };

  // Close the attendance modal
  const closeAttendanceModal = () => {
    setShowAttendanceModal(false);
  };

  // Show info modal
  const showInfo = (title, message, status = "info") => {
    setInfoModal({ open: true, title, message, status });
  };

  // Close info modal
  const closeInfoModal = () => {
    setInfoModal(prev => ({ ...prev, open: false }));
  };

  // Handle check-in/check-out for current user with location verification
  const handleAttendanceAction = async (action) => {
    if (!currentUser?.id) return;

    if (action === 'checkin') {
      // For check-in, show the modal with location verification
      openAttendanceModal();
      return;
    }

    // For check-out, use the standard flow
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`https://cubehis.avopay.pro:5000/api/employees/${currentUser.id}/attendance/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: `${action} by ${currentUser.full_name || currentUser.name}`,
          location: 'Office'
        })
      });

      if (response.ok) {
        const result = await response.json();
        showInfo(
          "Success",
          `${action === 'checkout' ? 'Checked out' : 'Attendance recorded'} successfully!`,
          "success"
        );
        fetchMyAttendance();
        fetchDashboardStats();
        fetchEmployees();
      } else {
        const error = await response.json();
        showInfo("Error", error.detail || `Failed to ${action}`, "error");
      }
    } catch (error) {
      console.error(`Error during ${action}:`, error);
      showInfo("Error", `Failed to ${action}. Please try again.`, "error");
    }
  };

  // Submit attendance with location verification
  const submitAttendance = async () => {
    if (!currentUser?.id) return;

    setAttendanceLoading(true);

    const userLat = parseFloat(geo.geo_lat);
    const userLong = parseFloat(geo.geo_long);

    if (isNaN(userLat) || isNaN(userLong)) {
      showInfo(
        "Location Error",
        "❌ Unable to detect your location. Please enable GPS and retry.",
        "error"
      );
      setAttendanceLoading(false);
      return;
    }

    const distance = haversineDistance(
      userLat,
      userLong,
      parseFloat(officeLocation.geo_lat),
      parseFloat(officeLocation.geo_long)
    );

    const inOfficeRange = !isNaN(distance) && distance <= OFFICE_RADIUS_KM;

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`https://cubehis.avopay.pro:5000/api/employees/${currentUser.id}/attendance/checkin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: `Checked in by ${currentUser.full_name || currentUser.name}`,
          location: geoAddress,
          geo_lat: userLat,
          geo_long: userLong,
          accuracy: geo.accuracy,
          in_range: inOfficeRange,
          distance_km: distance,
          status: inOfficeRange ? "present" : "remote"
        })
      });

      if (response.ok) {
        const result = await response.json();
        closeAttendanceModal();

        // Show appropriate message based on location
        if (inOfficeRange) {
          showInfo(
            "Attendance Marked",
            `📍 You are ${distance.toFixed(2)}km from office.\nStatus: PRESENT\nTime: ${new Date().toLocaleTimeString()}`,
            "success"
          );
        } else {
          showInfo(
            "Remote Attendance",
            `📍 You are ${distance.toFixed(2)}km from office.\nStatus: REMOTE\nTime: ${new Date().toLocaleTimeString()}\n\nYour attendance has been recorded as REMOTE since you're outside the office range.`,
            "info"
          );
        }

        fetchMyAttendance();
        fetchDashboardStats();
        fetchEmployees();
      } else {
        const error = await response.json();
        showInfo("Error", error.detail || "Failed to record attendance", "error");
      }
    } catch (error) {
      console.error(`Error during attendance submission:`, error);
      showInfo("Error", "Failed to record attendance. Please try again.", "error");
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Handle check-in/check-out for other employees
  const handleEmployeeAttendanceAction = async (employeeId, action) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`https://cubehis.avopay.pro:5000/api/employees/${employeeId}/attendance/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: `${action} by manager: ${currentUser.full_name || currentUser.name}`,
          location: 'Office'
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || `Employee ${action === 'checkin' ? 'checked in' : 'checked out'} successfully!`);
        fetchEmployees();
      } else {
        const error = await response.json();
        alert(error.detail || `Failed to ${action} employee`);
      }
    } catch (error) {
      console.error(`Error during employee ${action}:`, error);
      alert(`Failed to ${action} employee`);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // Geolocation functionality
  useEffect(() => {
    if (!showAttendanceModal) return; // Only activate when modal is open

    const MAX_WAIT_TIME_MS = 20000;
    const ACCEPTABLE_ACCURACY = 20;
    const MAX_READINGS = 10;
    let watchId;
    let hasSetLocation = false;

    const handleLocation = (latitude, longitude, accuracy) => {
      setLocationReadings(prev => {
        const newReadings = [...prev, { lat: latitude, lon: longitude, acc: accuracy }]
          .slice(-MAX_READINGS);
        if (newReadings.length === MAX_READINGS) {
          const avgLat = newReadings.reduce((sum, r) => sum + r.lat, 0) / MAX_READINGS;
          const avgLon = newReadings.reduce((sum, r) => sum + r.lon, 0) / MAX_READINGS;
          const bestAcc = Math.min(...newReadings.map(r => r.acc));
          if (bestAcc <= 50) {
            setGeo({ geo_lat: avgLat, geo_long: avgLon, accuracy: bestAcc });
            const now = new Date();
            setGeoTime(now.toISOString());
            fetchReverseGeocode(avgLat, avgLon);
            hasSetLocation = true;
          }
          return [];
        }
        return newReadings;
      });
    };

    const fetchReverseGeocode = async (lat, lon) => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const data = await res.json();
        setGeoAddress(data.display_name || "Unknown Location");
      } catch (err) {
        setGeoAddress("Unknown Location");
      }
    };

    const successWatch = (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      if (accuracy <= ACCEPTABLE_ACCURACY && !hasSetLocation) {
        hasSetLocation = true;
        setGeo({ geo_lat: latitude, geo_long: longitude, accuracy });
        const now = new Date();
        setGeoTime(now.toISOString());
        fetchReverseGeocode(latitude, longitude);
        navigator.geolocation.clearWatch(watchId);
      } else if (accuracy <= 100) {
        handleLocation(latitude, longitude, accuracy);
      }
    };

    const errorWatch = (err) => {
      setGeoError(true);
      setGeoAddress("Unable to detect location.");
    };

    const fallbackGet = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          if (!hasSetLocation) {
            hasSetLocation = true;
            setGeo({ geo_lat: latitude, geo_long: longitude, accuracy });
            const now = new Date();
            setGeoTime(now.toISOString());
            fetchReverseGeocode(latitude, longitude);
          }
        },
        (err) => {
          setGeoError(true);
          setGeoAddress("Unable to detect location.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(successWatch, errorWatch, {
        enableHighAccuracy: true,
        timeout: MAX_WAIT_TIME_MS,
        maximumAge: 0
      });

      const timeoutId = setTimeout(() => {
        if (!hasSetLocation) {
          navigator.geolocation.clearWatch(watchId);
          fallbackGet();
        }
      }, MAX_WAIT_TIME_MS + 2000);

      return () => {
        clearTimeout(timeoutId);
        navigator.geolocation.clearWatch(watchId);
      };
    } else {
      setGeoError(true);
      setGeoAddress("Geolocation not supported by browser.");
    }
  }, [showAttendanceModal]);

  useEffect(() => {
    if (currentUser && !showLogin) {
      fetchDashboardStats();
      fetchEmployees();
      fetchMyAttendance();
    }
  }, [currentUser, showLogin]);

  // Auto-login on component mount if no token
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token && !showLogin) {
      handleLogin();
    }
  }, []);

  // Login Component
  if (showLogin) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <img src="/bharat.png" alt="B2B CRM" className="h-12 w-12 rounded-full" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            HR & Staff Module Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Please sign in to access the HR module
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  Username
                </label>
                <div className="mt-1">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={loginCredentials.username}
                    onChange={(e) => setLoginCredentials({ ...loginCredentials, username: e.target.value })}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your username"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={loginCredentials.password}
                    onChange={(e) => setLoginCredentials({ ...loginCredentials, password: e.target.value })}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <i className="fas fa-exclamation-circle text-red-400 mt-0.5 mr-2"></i>
                    <div className="text-sm text-red-700">{loginError}</div>
                  </div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loginLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Signing in...
                    </div>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Demo Credentials</span>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-500 text-center">
                Username: amit24 | Password: Amit@123
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Attendance Modal is directly rendered in the main component

  // Dashboard Component
  const Dashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Employees</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardStats.total_employees || 0}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <i className="fas fa-users text-blue-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Present Today</p>
              <p className="text-2xl font-bold text-green-600">{dashboardStats.present_today || 0}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <i className="fas fa-check-circle text-green-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Absent Today</p>
              <p className="text-2xl font-bold text-red-600">{dashboardStats.absent_today || 0}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <i className="fas fa-times-circle text-red-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Leaves</p>
              <p className="text-2xl font-bold text-yellow-600">{dashboardStats.pending_leaves || 0}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <i className="fas fa-calendar-alt text-yellow-600"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => handleAttendanceAction('checkin')}
            className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <i className="fas fa-sign-in-alt text-green-600 text-xl mb-2"></i>
            <span className="text-sm font-medium text-green-700">Check In</span>
          </button>

          <button
            onClick={() => handleAttendanceAction('checkout')}
            className="flex flex-col items-center p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            <i className="fas fa-sign-out-alt text-red-600 text-xl mb-2"></i>
            <span className="text-sm font-medium text-red-700">Check Out</span>
          </button>

          <button
            onClick={() => setActiveTab('employees')}
            className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <i className="fas fa-users text-blue-600 text-xl mb-2"></i>
            <span className="text-sm font-medium text-blue-700">Manage Employees</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <i className="fas fa-clock text-purple-600 text-xl mb-2"></i>
            <span className="text-sm font-medium text-purple-700">View Attendance</span>
          </button>
        </div>
      </div>

      {/* Recent Attendance */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">My Recent Attendance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {myAttendance.slice(0, 5).map((record, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(record.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.check_in_time || record.checkin_time || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.check_out_time || record.checkout_time || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${record.status === 'present'
                        ? 'bg-green-100 text-green-800'
                        : record.status === 'absent'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                      {record.status || 'Unknown'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Employee Management Component
  const EmployeeManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Employee Management</h2>
        {hasPermission('hr') && (
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <i className="fas fa-plus mr-2"></i>Add Employee
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee, index) => (
                <tr key={employee.id || index}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <i className="fas fa-user text-gray-600"></i>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {employee.full_name || employee.name || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {employee.employee_id || employee.user_id || 'No ID'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {employee.email || 'No email'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {Array.isArray(employee.role_names)
                      ? employee.role_names.join(', ')
                      : employee.role_names || employee.roles || employee.role || 'No role'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {employee.department || 'No department'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${employee.is_active !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                      }`}>
                      {employee.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${employee.attendance_status?.status === 'present'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                          }`}>
                          {employee.attendance_status?.status || 'absent'}
                        </span>
                      </div>
                      {employee.can_manage_attendance && (
                        <div className="flex space-x-1">
                          {employee.attendance_status?.can_checkin && (
                            <button
                              onClick={() => handleEmployeeAttendanceAction(employee.user_id || employee.employee_id, 'checkin')}
                              className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                              title="Check In"
                            >
                              In
                            </button>
                          )}
                          {employee.attendance_status?.can_checkout && (
                            <button
                              onClick={() => handleEmployeeAttendanceAction(employee.user_id || employee.employee_id, 'checkout')}
                              className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                              title="Check Out"
                            >
                              Out
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-900">
                        <i className="fas fa-eye"></i>
                      </button>
                      {hasPermission('hr') && (
                        <>
                          <button className="text-green-600 hover:text-green-900">
                            <i className="fas fa-edit"></i>
                          </button>
                          <button className="text-red-600 hover:text-red-900">
                            <i className="fas fa-trash"></i>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Attendance Management Component
  const AttendanceManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Attendance Management</h2>
        <div className="flex space-x-2">
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
            <i className="fas fa-download mr-2"></i>Export
          </button>
          <button
            onClick={() => handleAttendanceAction('checkin')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <i className="fas fa-calendar-plus mr-2"></i>Mark Attendance
          </button>
        </div>
      </div>

      {/* Attendance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Present</p>
              <p className="text-3xl font-bold text-green-600">{dashboardStats.present_today || 0}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <i className="fas fa-user-check text-green-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Absent</p>
              <p className="text-3xl font-bold text-red-600">{dashboardStats.absent_today || 0}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <i className="fas fa-user-times text-red-600 text-xl"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">On Leave</p>
              <p className="text-3xl font-bold text-yellow-600">{dashboardStats.on_leave_today || 0}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <i className="fas fa-calendar-times text-yellow-600 text-xl"></i>
            </div>
          </div>
        </div>
      </div>

      {/* My Attendance Detail */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">My Attendance History</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Working Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {myAttendance.map((record, index) => {
                const checkInTime = record.check_in_time || record.checkin_time;
                const checkOutTime = record.check_out_time || record.checkout_time;
                const workingHours = record.working_hours || '-';

                return (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(record.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {checkInTime || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {checkOutTime || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {workingHours} {workingHours !== '-' ? 'hours' : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${record.status === 'present'
                          ? 'bg-green-100 text-green-800'
                          : record.status === 'absent'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {record.status || 'Unknown'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Profile Management Component
  const ProfileManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">My Profile</h2>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          <i className="fas fa-sign-out-alt mr-2"></i>Logout
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start space-x-6">
          <div className="flex-shrink-0">
            <div className="h-24 w-24 rounded-full bg-gray-300 flex items-center justify-center">
              <i className="fas fa-user text-gray-600 text-3xl"></i>
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {currentUser?.full_name || currentUser?.name || 'Unknown User'}
              </h3>
              <p className="text-gray-600">{currentUser?.email || 'No email'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                <p className="mt-1 text-sm text-gray-900">{currentUser?.employee_id || currentUser?.id || 'N/A'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Department</label>
                <p className="mt-1 text-sm text-gray-900">{currentUser?.department || 'Not assigned'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <p className="mt-1 text-sm text-gray-900">
                  {Array.isArray(currentUser?.roles)
                    ? currentUser.roles.join(', ')
                    : currentUser?.role || currentUser?.roles || 'No role assigned'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Join Date</label>
                <p className="mt-1 text-sm text-gray-900">
                  {currentUser?.join_date
                    ? new Date(currentUser.join_date).toLocaleDateString()
                    : 'Not available'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documents Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">My Documents</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer">
            <i className="fas fa-file-upload text-gray-400 text-3xl mb-2"></i>
            <p className="text-sm text-gray-600">Upload Documents</p>
          </div>
        </div>
      </div>

      {/* Leave Requests Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">My Leave Requests</h3>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <i className="fas fa-plus mr-2"></i>Request Leave
          </button>
        </div>

        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-calendar-alt text-4xl mb-2"></i>
          <p>No leave requests found</p>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'chart-pie', component: Dashboard },
    { id: 'employees', label: 'Employees', icon: 'users', component: EmployeeManagement },
    { id: 'attendance', label: 'Attendance', icon: 'clock', component: AttendanceManagement },
    { id: 'profile', label: 'My Profile', icon: 'user', component: ProfileManagement },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || Dashboard;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">HR & Staff Management</h1>
              <p className="text-gray-600">Welcome back, {currentUser?.full_name || currentUser?.name || 'User'}</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
              <button
                onClick={handleLogout}
                className="text-red-600 hover:text-red-700"
                title="Logout"
              >
                <i className="fas fa-sign-out-alt"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <i className={`fas fa-${tab.icon}`}></i>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ActiveComponent />
      </div>

      {/* Attendance Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeAttendanceModal(); }}>
          <div
            className="bg-white max-w-lg w-full rounded-2xl shadow-2xl p-8 relative"
            style={{
              maxHeight: "98vh",
              overflowY: "auto",
              background: `linear-gradient(rgba(242, 244, 246, 0.84), rgba(217, 242, 234, 0.6))`,
              backdropFilter: 'blur(1px)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl"
              onClick={closeAttendanceModal}
              aria-label="Close form"
            >
              ×
            </button>
            <h2 className="text-xl font-bold text-indigo-700 mb-6 text-center">Mark Attendance</h2>

            <div className="text-sm text-gray-600 mb-6 bg-white p-4 rounded-lg shadow-inner">
              <div className="font-medium mb-2 text-indigo-700">Your Current Location:</div>
              {geo.geo_lat && geo.geo_long ? (
                <>
                  <div className="text-green-600 font-medium">
                    ({geo.geo_lat.toFixed(6)}, {geo.geo_long.toFixed(6)})
                  </div>
                  <div className="text-blue-700 mt-1">{geoAddress}</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Accuracy: {geo.accuracy.toFixed(1)}m
                  </div>
                  <div className="text-xs text-gray-500">
                    Updated: {geoTime ? new Date(geoTime).toLocaleTimeString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    }) : ""}
                  </div>

                  {/* Show distance from office */}
                  {geo.geo_lat && geo.geo_long && (
                    <div className="mt-3 border-t pt-3 text-sm">
                      <div className="font-medium">Distance from Office:</div>
                      {(() => {
                        const distance = haversineDistance(
                          geo.geo_lat,
                          geo.geo_long,
                          officeLocation.geo_lat,
                          officeLocation.geo_long
                        );
                        const inRange = distance <= OFFICE_RADIUS_KM;

                        return (
                          <div className={`font-medium ${inRange ? 'text-green-600' : 'text-red-600'}`}>
                            {distance.toFixed(2)} km {inRange ? '(Within Range)' : '(Outside Range)'}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </>
              ) : geoError ? (
                <div className="text-red-500">
                  Unable to detect device location. Please enable location services.
                </div>
              ) : (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
                  Detecting your location...
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 justify-center mt-6">
              <button
                onClick={submitAttendance}
                disabled={attendanceLoading || !geo.geo_lat || !geo.geo_long}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold shadow disabled:opacity-50 transition"
              >
                {attendanceLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </div>
                ) : "Mark Attendance"}
              </button>
              <button
                onClick={closeAttendanceModal}
                className="px-8 py-3 rounded-xl bg-gray-200 text-gray-700 hover:bg-gray-300 transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {infoModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => closeInfoModal()}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 relative"
            onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl"
              onClick={closeInfoModal}
              aria-label="Close"
            >
              ×
            </button>
            <div className="flex flex-col items-center mb-4">
              {infoModal.status === "success" && (
                <svg className="w-12 h-12 text-green-500 mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path d="M9 12l2 2l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              )}
              {infoModal.status === "error" && (
                <svg className="w-12 h-12 text-red-500 mb-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" />
                  <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <h3 className="text-lg font-medium">{infoModal.title}</h3>
            </div>
            <div className="whitespace-pre-line text-center">
              {infoModal.message}
            </div>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                onClick={closeInfoModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRStaffModuleComplete;
