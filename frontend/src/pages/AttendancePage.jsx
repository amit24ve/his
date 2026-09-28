import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";

// API base URL
const API_BASE_URL = "https://cubehis.avopay.pro:5000";

const AttendancePage = () => {
  // State management
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [attendance, setAttendance] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [checkInLocation, setCheckInLocation] = useState(null);
  const [checkOutLocation, setCheckOutLocation] = useState(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Get current date in YYYY-MM-DD format for API calls
  const today = new Date().toISOString().split('T')[0];

  // Fetch current user on component mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          console.error("No access token found");
          setIsLoading(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          console.log("Current user data:", userData);
          setCurrentUser(userData);
          fetchAttendance(userData.id || userData._id || userData.user_id);
        } else {
          console.error("Failed to fetch current user");
          toast.error("Failed to load user data");
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
        toast.error("Error loading user data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  // Fetch attendance records for the current user
  const fetchAttendance = async (userId) => {
    if (!userId) return;

    try {
      setIsLoading(true);
      const token = localStorage.getItem("access_token");

      // Get attendance records from HR API
      const response = await fetch(
        `${API_BASE_URL}/api/hr/attendance?user_id=${userId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Attendance data from HR API:", data);

        // Set all attendance records
        if (data.success && data.data) {
          // Normalize the data format
          const normalizedRecords = data.data.map(record => {
            // Convert check_in and check_out to ISO format if they're in different formats
            const processRecord = { ...record };

            // Add checkin_time from check_in if needed
            if (record.check_in && !record.checkin_time) {
              processRecord.checkin_time = new Date(`${record.date}T${record.check_in}`);
            }

            // Add checkout_time from check_out if needed
            if (record.check_out && !record.checkout_time) {
              processRecord.checkout_time = new Date(`${record.date}T${record.check_out}`);
            }

            // Create geo_location object if it doesn't exist but we have geo_lat and geo_long
            if (record.geo_lat && record.geo_long && !record.geo_location) {
              processRecord.geo_location = {
                latitude: record.geo_lat,
                longitude: record.geo_long,
                address: record.location || `Lat: ${record.geo_lat}, Long: ${record.geo_long}`
              };
            }

            // Create checkout_geo_location object if it doesn't exist but we have checkout_geo_lat and checkout_geo_long
            if (record.checkout_geo_lat && record.checkout_geo_long && !record.checkout_geo_location) {
              processRecord.checkout_geo_location = {
                latitude: record.checkout_geo_lat,
                longitude: record.checkout_geo_long,
                address: record.checkout_location || `Lat: ${record.checkout_geo_lat}, Long: ${record.checkout_geo_long}`
              };
            }

            return processRecord;
          });

          setAttendance(normalizedRecords);

          // Find today's attendance record if it exists
          const todayRecord = normalizedRecords.find(record => record.date === today);
          if (todayRecord) {
            console.log("Found today's attendance record:", todayRecord);

            // Check for locally stored geolocation data
            try {
              // Get check-in geo data
              const storedGeoData = sessionStorage.getItem(`attendance_${today}_geo_data`);
              if (storedGeoData) {
                const geoData = JSON.parse(storedGeoData);
                // Merge with record
                Object.assign(todayRecord, geoData);
              }

              // Get check-out geo data
              const storedCheckoutGeoData = sessionStorage.getItem(`attendance_${today}_checkout_geo_data`);
              if (storedCheckoutGeoData) {
                const checkoutGeoData = JSON.parse(storedCheckoutGeoData);
                // Merge with record
                Object.assign(todayRecord, checkoutGeoData);
              }
            } catch (error) {
              console.error("Error retrieving stored geolocation data:", error);
            }

            setTodayAttendance(todayRecord);
          } else {
            console.log("No attendance record found for today");
            setTodayAttendance(null); // No attendance record for today
          }
        } else {
          setAttendance([]);
          setTodayAttendance(null);
        }
      } else {
        console.log("Failed to fetch attendance records:", await response.text());
        setAttendance([]);
        setTodayAttendance(null);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
      toast.error("Error loading attendance records");
      setAttendance([]);
      setTodayAttendance(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle check-in
  const handleCheckIn = async () => {
    try {
      setIsCheckingIn(true);

      // Get current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const location = { latitude, longitude };
            setCheckInLocation(location);

            // Get address using reverse geocoding
            try {
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                { headers: { "Accept-Language": "en" } }
              );

              if (response.ok) {
                const data = await response.json();
                const address = data.display_name || "Unknown location";

                // Now send check-in to API
                await submitCheckIn(location, address);
              } else {
                // If geocoding fails, just use coordinates
                await submitCheckIn(location, `Lat: ${latitude}, Long: ${longitude}`);
              }
            } catch (error) {
              console.error("Error getting location address:", error);
              await submitCheckIn(location, `Lat: ${latitude}, Long: ${longitude}`);
            }
          },
          (error) => {
            console.error("Error getting location:", error);
            toast.error("Failed to get location. Please enable location services.");
            setIsCheckingIn(false);
          }
        );
      } else {
        toast.error("Geolocation is not supported by this browser.");
        setIsCheckingIn(false);
      }
    } catch (error) {
      console.error("Error during check-in:", error);
      toast.error("Check-in failed");
      setIsCheckingIn(false);
    }
  };

  // Submit check-in to API
  const submitCheckIn = async (location, address) => {
    try {
      const token = localStorage.getItem("access_token");
      const userId = currentUser?.id || currentUser?._id || currentUser?.user_id;

      if (!userId) {
        toast.error("User ID not found");
        setIsCheckingIn(false);
        return;
      }

      const checkInData = {
        user_id: userId,
        date: today,
        checkin_time: new Date().toISOString(),
        location: address,
        geo_lat: location.latitude,
        geo_long: location.longitude,
        geo_location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: address
        },
        status: "present"
      };

      // Log the check-in data being sent
      console.log("Sending check-in data to API:", JSON.stringify(checkInData, null, 2));

      const response = await fetch(`${API_BASE_URL}/api/hr/attendance/checkin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(checkInData),
      });

      const responseData = await response.json();
      console.log("Check-in response:", responseData);

      if (response.ok) {
        toast.success("Checked in successfully!");

        // Since backend doesn't store geo data, store it locally
        const localData = {
          geo_lat: location.latitude,
          geo_long: location.longitude,
          geo_location: {
            latitude: location.latitude,
            longitude: location.longitude,
            address: address
          },
          location: address
        };

        // Store in session storage for this session only
        sessionStorage.setItem(`attendance_${today}_geo_data`, JSON.stringify(localData));

        // Refresh attendance data
        fetchAttendance(userId);
      } else if (response.status === 400 && responseData.detail === "Already checked in today" && responseData.record) {
        // Handle already checked in case
        toast.info("You have already checked in today");

        // Create a record object with all data from the API response
        const record = responseData.record;

        // Update today's attendance with the record from the API
        setTodayAttendance({
          _id: record._id,
          checkin_time: new Date(`${record.date}T${record.check_in}`),
          checkout_time: record.check_out ? new Date(`${record.date}T${record.check_out}`) : null,
          date: record.date,
          location: record.location || "",
          status: record.status,
          working_hours: record.working_hours,
          user_id: record.user_id,
          user_name: record.user_name,
          geo_lat: record.geo_lat,
          geo_long: record.geo_long,
          checkout_geo_lat: record.checkout_geo_lat,
          checkout_geo_long: record.checkout_geo_long,
          // Create geo_location object if needed
          geo_location: record.geo_location || (record.geo_lat && record.geo_long ? {
            latitude: record.geo_lat,
            longitude: record.geo_long,
            address: record.location || `Lat: ${record.geo_lat}, Long: ${record.geo_long}`
          } : (location ? {
            latitude: location.latitude,
            longitude: location.longitude,
            address: address
          } : undefined))
        });
      } else {
        console.error("Check-in failed:", responseData.detail || "Unknown error");
        toast.error("Check-in failed: " + (responseData.detail || "Unknown error"));
      }
    } catch (error) {
      console.error("Error submitting check-in:", error);
      toast.error("Error submitting check-in");
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Handle check-out
  const handleCheckOut = async () => {
    try {
      setIsCheckingOut(true);

      // Get current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const location = { latitude, longitude };
            setCheckOutLocation(location);

            // Get address using reverse geocoding
            try {
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                { headers: { "Accept-Language": "en" } }
              );

              if (response.ok) {
                const data = await response.json();
                const address = data.display_name || "Unknown location";

                // Now send check-out to API
                await submitCheckOut(location, address);
              } else {
                // If geocoding fails, just use coordinates
                await submitCheckOut(location, `Lat: ${latitude}, Long: ${longitude}`);
              }
            } catch (error) {
              console.error("Error getting location address:", error);
              await submitCheckOut(location, `Lat: ${latitude}, Long: ${longitude}`);
            }
          },
          (error) => {
            console.error("Error getting location:", error);
            toast.error("Failed to get location. Please enable location services.");
            setIsCheckingOut(false);
          }
        );
      } else {
        toast.error("Geolocation is not supported by this browser.");
        setIsCheckingOut(false);
      }
    } catch (error) {
      console.error("Error during check-out:", error);
      toast.error("Check-out failed");
      setIsCheckingOut(false);
    }
  };

  // Submit check-out to API
  const submitCheckOut = async (location, address) => {
    try {
      const token = localStorage.getItem("access_token");
      const userId = currentUser?.id || currentUser?._id || currentUser?.user_id;

      if (!userId) {
        toast.error("User ID not found");
        setIsCheckingOut(false);
        return;
      }

      if (!todayAttendance || (!todayAttendance._id && !todayAttendance.id)) {
        toast.error("No check-in record found for today");
        setIsCheckingOut(false);
        return;
      }

      const checkOutData = {
        attendance_id: todayAttendance._id || todayAttendance.id,
        user_id: userId,
        checkout_time: new Date().toISOString(),
        checkout_location: address,
        checkout_geo_lat: location.latitude,
        checkout_geo_long: location.longitude,
        checkout_geo_location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: address
        },
        notes: `checkout by ${currentUser?.full_name || currentUser?.username || 'user'}`
      };

      // Log the check-out data being sent
      console.log("Sending check-out data to API:", JSON.stringify(checkOutData, null, 2));

      const response = await fetch(`${API_BASE_URL}/api/hr/attendance/checkout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(checkOutData),
      });

      const responseData = await response.json();
      console.log("Check-out response:", responseData);

      if (response.ok) {
        toast.success("Checked out successfully!");

        // Since backend doesn't store geo data, store it locally
        const localData = {
          checkout_geo_lat: location.latitude,
          checkout_geo_long: location.longitude,
          checkout_geo_location: {
            latitude: location.latitude,
            longitude: location.longitude,
            address: address
          },
          checkout_location: address
        };

        // Store in session storage for this session only
        sessionStorage.setItem(`attendance_${today}_checkout_geo_data`, JSON.stringify(localData));

        // Refresh attendance data
        fetchAttendance(userId);
      } else if (response.status === 400 && responseData.detail && responseData.record) {
        if (responseData.detail.includes("already checked out")) {
          toast.info("You have already checked out today");

          // Create a record object with all data from the API response
          const record = responseData.record;

          // Update today's attendance with the record from the API
          setTodayAttendance({
            _id: record._id,
            checkin_time: record.check_in ? new Date(`${record.date}T${record.check_in}`) : null,
            checkout_time: record.check_out ? new Date(`${record.date}T${record.check_out}`) : null,
            date: record.date,
            location: record.location || "",
            checkout_location: record.checkout_location || "",
            status: record.status,
            working_hours: record.working_hours,
            user_id: record.user_id,
            user_name: record.user_name,
            geo_lat: record.geo_lat,
            geo_long: record.geo_long,
            checkout_geo_lat: record.checkout_geo_lat,
            checkout_geo_long: record.checkout_geo_long,
            // Create geo_location objects if needed
            geo_location: record.geo_location || (record.geo_lat && record.geo_long ? {
              latitude: record.geo_lat,
              longitude: record.geo_long,
              address: record.location || `Lat: ${record.geo_lat}, Long: ${record.geo_long}`
            } : undefined),
            checkout_geo_location: record.checkout_geo_location || (record.checkout_geo_lat && record.checkout_geo_long ? {
              latitude: record.checkout_geo_lat,
              longitude: record.checkout_geo_long,
              address: record.checkout_location || `Lat: ${record.checkout_geo_lat}, Long: ${record.checkout_geo_long}`
            } : (location ? {
              latitude: location.latitude,
              longitude: location.longitude,
              address: address
            } : undefined))
          });
        } else {
          toast.error("Check-out failed: " + responseData.detail);
        }
      } else {
        console.error("Check-out failed:", responseData.detail || "Unknown error");
        toast.error("Check-out failed: " + (responseData.detail || "Unknown error"));
      }
    } catch (error) {
      console.error("Error submitting check-out:", error);
      toast.error("Error submitting check-out");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  };

  // Format time for display
  const formatTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Invalid time";
    }
  };

  // Calculate work duration
  const calculateDuration = (checkinTime, checkoutTime) => {
    if (!checkinTime || !checkoutTime) return "N/A";

    try {
      const checkInTime = new Date(checkinTime).getTime();
      const checkOutTime = new Date(checkoutTime).getTime();

      if (isNaN(checkInTime) || isNaN(checkOutTime)) return "N/A";

      const durationMs = checkOutTime - checkInTime;
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

      return `${hours}h ${minutes}m`;
    } catch (error) {
      console.error("Error calculating duration:", error);
      return "N/A";
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="flex flex-col p-6">
        <motion.h1
          className="text-3xl font-bold text-indigo-700 mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          My Attendance
        </motion.h1>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <>
            {/* Check-in/Check-out Section */}
            <motion.div
              className="bg-white rounded-lg shadow-md p-6 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Today's Attendance</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Check-in Status</h3>
                  {todayAttendance && (todayAttendance.checkin_time || todayAttendance.check_in) ? (
                    <div className="text-green-600">
                      <div className="font-bold">
                        Checked in at: {
                          todayAttendance.checkin_time
                            ? formatTime(todayAttendance.checkin_time)
                            : todayAttendance.check_in
                        }
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {todayAttendance.location ||
                          (todayAttendance.geo_location && todayAttendance.geo_location.address) ||
                          "Location not available"}
                      </div>
                      {(todayAttendance.geo_location || (todayAttendance.geo_lat && todayAttendance.geo_long)) && (
                        <div className="text-xs text-gray-400 mt-1">
                          Coordinates: {
                            todayAttendance.geo_location
                              ? `${todayAttendance.geo_location.latitude}, ${todayAttendance.geo_location.longitude}`
                              : `${todayAttendance.geo_lat}, ${todayAttendance.geo_long}`
                          }
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <button
                        onClick={handleCheckIn}
                        disabled={isCheckingIn}
                        className={`px-4 py-2 rounded-md font-medium ${isCheckingIn
                            ? "bg-gray-400 text-gray-200"
                            : "bg-green-600 text-white hover:bg-green-700"
                          } transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50`}
                      >
                        {isCheckingIn ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          </span>
                        ) : (
                          "Check In"
                        )}
                      </button>
                      <span className="ml-3 text-sm text-gray-500">(Uses your current location)</span>
                    </div>
                  )}
                </div>

                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Check-out Status</h3>
                  {todayAttendance && (todayAttendance.checkout_time || todayAttendance.check_out) ? (
                    <div className="text-blue-600">
                      <div className="font-bold">
                        Checked out at: {
                          todayAttendance.checkout_time
                            ? formatTime(todayAttendance.checkout_time)
                            : todayAttendance.check_out
                        }
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {todayAttendance.checkout_location ||
                          (todayAttendance.checkout_geo_location && todayAttendance.checkout_geo_location.address) ||
                          "Location not available"}
                      </div>
                      {(todayAttendance.checkout_geo_location || (todayAttendance.checkout_geo_lat && todayAttendance.checkout_geo_long)) && (
                        <div className="text-xs text-gray-400 mt-1">
                          Coordinates: {
                            todayAttendance.checkout_geo_location
                              ? `${todayAttendance.checkout_geo_location.latitude}, ${todayAttendance.checkout_geo_location.longitude}`
                              : `${todayAttendance.checkout_geo_lat}, ${todayAttendance.checkout_geo_long}`
                          }
                        </div>
                      )}
                      <div className="mt-2 text-gray-700">
                        Working Hours: {
                          todayAttendance.working_hours
                            ? `${todayAttendance.working_hours} hrs`
                            : calculateDuration(
                              todayAttendance.checkin_time || new Date(`${todayAttendance.date}T${todayAttendance.check_in}`),
                              todayAttendance.checkout_time || new Date(`${todayAttendance.date}T${todayAttendance.check_out}`)
                            )
                        }
                      </div>
                    </div>
                  ) : todayAttendance && (todayAttendance.checkin_time || todayAttendance.check_in) ? (
                    <div className="flex items-center">
                      <button
                        onClick={handleCheckOut}
                        disabled={isCheckingOut}
                        className={`px-4 py-2 rounded-md font-medium ${isCheckingOut
                            ? "bg-gray-400 text-gray-200"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                          } transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
                      >
                        {isCheckingOut ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          </span>
                        ) : (
                          "Check Out"
                        )}
                      </button>
                      <span className="ml-3 text-sm text-gray-500">(Uses your current location)</span>
                    </div>
                  ) : (
                    <div className="text-gray-500">Please check in first</div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Attendance History */}
            <motion.div
              className="bg-white rounded-lg shadow-md p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Attendance History</h2>

              <div className="overflow-x-auto">
                {attendance && attendance.length > 0 ? (
                  <table className="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="py-3 px-4 text-left text-gray-600 font-semibold">Date</th>
                        <th className="py-3 px-4 text-left text-gray-600 font-semibold">Check In</th>
                        <th className="py-3 px-4 text-left text-gray-600 font-semibold">Location</th>
                        <th className="py-3 px-4 text-left text-gray-600 font-semibold">Check Out</th>
                        <th className="py-3 px-4 text-left text-gray-600 font-semibold">Location</th>
                        <th className="py-3 px-4 text-left text-gray-600 font-semibold">Duration</th>
                        <th className="py-3 px-4 text-left text-gray-600 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {attendance.map((record, index) => (
                        <tr key={record._id || index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="py-3 px-4 text-gray-800">{formatDate(record.date)}</td>
                          <td className="py-3 px-4">
                            {record.checkin_time ? formatTime(record.checkin_time) : record.check_in ? record.check_in : "N/A"}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {record.location ||
                              (record.geo_location && record.geo_location.address) ||
                              (record.geo_lat && record.geo_long && `${record.geo_lat.toFixed(6)}, ${record.geo_long.toFixed(6)}`) ||
                              "N/A"}
                          </td>
                          <td className="py-3 px-4">
                            {record.checkout_time ? formatTime(record.checkout_time) : record.check_out ? record.check_out : "N/A"}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {record.checkout_location ||
                              (record.checkout_geo_location && record.checkout_geo_location.address) ||
                              (record.checkout_geo_lat && record.checkout_geo_long && `${record.checkout_geo_lat.toFixed(6)}, ${record.checkout_geo_long.toFixed(6)}`) ||
                              "N/A"}
                          </td>
                          <td className="py-3 px-4">
                            {record.working_hours ? `${record.working_hours} hrs` :
                              (record.checkin_time && record.checkout_time) ? calculateDuration(record.checkin_time, record.checkout_time) :
                                (record.check_in && record.check_out) ? `${record.working_hours || 0} hrs` : "N/A"}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${record.status === "present"
                                  ? "bg-green-100 text-green-800"
                                  : record.status === "absent"
                                    ? "bg-red-100 text-red-800"
                                    : record.status === "half_day"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : record.status === "leave"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-gray-100 text-gray-800"
                                }`}
                            >
                              {record.status === "present"
                                ? "Present"
                                : record.status === "absent"
                                  ? "Absent"
                                  : record.status === "half_day"
                                    ? "Half Day"
                                    : record.status === "leave"
                                      ? "On Leave"
                                      : record.status || "Unknown"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-4 text-gray-500">No attendance records found</div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default AttendancePage;
