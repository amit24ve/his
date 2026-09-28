import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://cubehis.avopay.pro:5000";

const LeaveRequestsPage = () => {
  // State management
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);

  // New leave request form
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewRequestForm, setShowNewRequestForm] = useState(false);
  const [newRequest, setNewRequest] = useState({
    type: "casual",
    start_date: "",
    end_date: "",
    reason: "",
    contact_info: "",
    half_day: false,
    first_half: true,
  });

  // Fetch current user on component mount
  // Fetch leave types from the API
  const fetchLeaveTypes = async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/hr/leave-types`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Leave types:", data);

        if (data.data && Array.isArray(data.data)) {
          setLeaveTypes(data.data);
          // Set default type if available
          if (data.data.length > 0) {
            setNewRequest(prev => ({
              ...prev,
              type: data.data[0].type || data.data[0].name || "casual"
            }));
          }
        } else {
          // Fallback to default types if API doesn't return expected format
          setLeaveTypes([
            { type: "casual", name: "Casual Leave" },
            { type: "sick", name: "Sick Leave" },
            { type: "annual", name: "Annual Leave" }
          ]);
        }
      } else {
        console.error("Failed to fetch leave types");
        // Fallback to default types
        setLeaveTypes([
          { type: "casual", name: "Casual Leave" },
          { type: "sick", name: "Sick Leave" },
          { type: "annual", name: "Annual Leave" }
        ]);
      }
    } catch (error) {
      console.error("Error fetching leave types:", error);
      // Fallback to default types
      setLeaveTypes([
        { type: "casual", name: "Casual Leave" },
        { type: "sick", name: "Sick Leave" },
        { type: "annual", name: "Annual Leave" }
      ]);
    }
  };

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

          // After getting user, fetch their leave data
          fetchLeaveData(userData.id || userData._id || userData.user_id);

          // Also fetch leave types
          fetchLeaveTypes();
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

  // Fetch leave requests for the current user only
  const fetchLeaveData = async (userId) => {
    if (!userId) return;

    try {
      setIsLoading(true);
      const token = localStorage.getItem("access_token");

      // Fetch leave requests - explicitly for current user only
      const requestsResponse = await fetch(
        `${API_BASE_URL}/api/hr/leave-requests?user_id=${userId}&current_user_only=true`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (requestsResponse.ok) {
        const data = await requestsResponse.json();
        console.log("Current user leave requests:", data);

        if (data.data) {
          // Ensure we're only setting leave requests for the current user
          const currentUserRequests = Array.isArray(data.data)
            ? data.data.filter(request =>
              request.user_id === userId ||
              request.employee_id === userId)
            : [];

          setLeaveRequests(currentUserRequests);
        }
      } else {
        console.error("Failed to fetch leave requests");
        toast.error("Failed to load leave requests");
      }
    } catch (error) {
      console.error("Error fetching leave data:", error);
      toast.error("Error loading leave data");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle input change in leave request form
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewRequest((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Calculate number of days between start and end date
  const calculateDays = (start, end, halfDay = false) => {
    if (!start || !end) return 0;

    try {
      const startDate = new Date(start);
      const endDate = new Date(end);

      if (isNaN(startDate) || isNaN(endDate)) return 0;

      // Add 1 because both start and end days are inclusive
      const diffTime = endDate - startDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      // Adjust for half day if needed
      return halfDay ? diffDays - 0.5 : diffDays;
    } catch (error) {
      console.error("Error calculating days:", error);
      return 0;
    }
  };

  // Handle form submission
  const handleSubmitRequest = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!newRequest.start_date || !newRequest.end_date || !newRequest.reason) {
      toast.error("Please fill all required fields");
      return;
    }

    // Validate dates
    const start = new Date(newRequest.start_date);
    const end = new Date(newRequest.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      toast.error("Start date cannot be in the past");
      return;
    }

    if (end < start) {
      toast.error("End date cannot be before start date");
      return;
    }

    const daysRequested = calculateDays(
      newRequest.start_date,
      newRequest.end_date,
      newRequest.half_day
    );

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem("access_token");
      const userId = currentUser?.id || currentUser?._id || currentUser?.user_id;

      if (!userId) {
        toast.error("User ID not found");
        return;
      }

      const leaveData = {
        user_id: userId,
        leave_type: newRequest.type, // Changed from 'type' to 'leave_type' to match API requirements
        start_date: newRequest.start_date,
        end_date: newRequest.end_date,
        reason: newRequest.reason,
        contact_info: newRequest.contact_info || null,
        half_day: newRequest.half_day,
        first_half: newRequest.first_half,
        status: "pending",
        days: daysRequested
      };

      const response = await fetch(`${API_BASE_URL}/api/hr/leave-requests`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(leaveData),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Leave request submitted successfully!");
        console.log("Leave request response:", data);

        // Reset form and close it
        setNewRequest({
          type: "casual",
          start_date: "",
          end_date: "",
          reason: "",
          contact_info: "",
          half_day: false,
          first_half: true,
        });
        setShowNewRequestForm(false);

        // Refresh leave data
        fetchLeaveData(userId);
      } else {
        console.error("Leave request failed:", await response.text());
        toast.error("Leave request failed");
      }
    } catch (error) {
      console.error("Error submitting leave request:", error);
      toast.error("Error submitting leave request");
    } finally {
      setIsSubmitting(false);
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

  // Get status class for styling
  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // No longer need handleCancelRequest as we removed the cancel button

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="flex flex-col p-6">
        <motion.h1
          className="text-3xl font-bold text-indigo-700 mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          My Personal Leave Requests
        </motion.h1>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <>
            {/* Request Leave Button Section */}
            <motion.div
              className="bg-white rounded-lg shadow-md p-6 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Request New Leave</h2>
                <button
                  onClick={() => setShowNewRequestForm(!showNewRequestForm)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
                >
                  {showNewRequestForm ? "Cancel Request" : "Request Leave"}
                </button>
              </div>

              {/* New Leave Request Form */}
              {showNewRequestForm && (
                <motion.div
                  className="border border-gray-200 rounded-lg p-4"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.3 }}
                >
                  <h3 className="text-lg font-medium text-gray-800 mb-4">New Leave Request</h3>

                  <form onSubmit={handleSubmitRequest}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                        <select
                          name="type"
                          value={newRequest.type}
                          onChange={handleInputChange}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                        >
                          {leaveTypes.length > 0 ? (
                            leaveTypes.map((leaveType) => (
                              <option key={leaveType.id || leaveType.type} value={leaveType.type || leaveType.name.toLowerCase()}>
                                {leaveType.name || leaveType.type}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="casual">Casual Leave</option>
                              <option value="sick">Sick Leave</option>
                              <option value="annual">Annual Leave</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div className="flex items-center">
                        <div className="flex items-center mr-6">
                          <input
                            type="checkbox"
                            id="half_day"
                            name="half_day"
                            checked={newRequest.half_day}
                            onChange={handleInputChange}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <label htmlFor="half_day" className="ml-2 text-sm text-gray-700">
                            Half Day
                          </label>
                        </div>

                        {newRequest.half_day && (
                          <div className="flex items-center">
                            <label className="mr-2 text-sm text-gray-700">Which half:</label>
                            <div className="flex items-center mr-3">
                              <input
                                type="radio"
                                id="first_half_yes"
                                name="first_half"
                                checked={newRequest.first_half}
                                onChange={() => setNewRequest({ ...newRequest, first_half: true })}
                                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                              />
                              <label htmlFor="first_half_yes" className="ml-1 text-sm text-gray-700">
                                First Half
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="radio"
                                id="first_half_no"
                                name="first_half"
                                checked={!newRequest.first_half}
                                onChange={() => setNewRequest({ ...newRequest, first_half: false })}
                                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                              />
                              <label htmlFor="first_half_no" className="ml-1 text-sm text-gray-700">
                                Second Half
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Date
                        </label>
                        <input
                          type="date"
                          name="start_date"
                          value={newRequest.start_date}
                          onChange={handleInputChange}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                          min={new Date().toISOString().split("T")[0]}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Date
                        </label>
                        <input
                          type="date"
                          name="end_date"
                          value={newRequest.end_date}
                          onChange={handleInputChange}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          required
                          min={newRequest.start_date || new Date().toISOString().split("T")[0]}
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reason for Leave
                      </label>
                      <textarea
                        name="reason"
                        value={newRequest.reason}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        rows="3"
                        required
                      ></textarea>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Emergency Contact Info (Optional)
                      </label>
                      <input
                        type="text"
                        name="contact_info"
                        value={newRequest.contact_info}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Phone number or email"
                      />
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        {newRequest.start_date && newRequest.end_date ? (
                          <span>
                            Days requested:{" "}
                            <strong>
                              {calculateDays(
                                newRequest.start_date,
                                newRequest.end_date,
                                newRequest.half_day
                              )}
                            </strong>
                          </span>
                        ) : null}
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`px-4 py-2 rounded-md font-medium ${isSubmitting
                            ? "bg-gray-400 text-gray-200"
                            : "bg-indigo-600 text-white hover:bg-indigo-700"
                          } transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50`}
                      >
                        {isSubmitting ? "Submitting..." : "Submit Request"}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </motion.div>

            {/* Leave Requests History */}
            <motion.div
              className="bg-white rounded-lg shadow-md p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h2 className="text-xl font-semibold text-gray-800 mb-4">My Leave Request History</h2>

              <div className="overflow-x-auto">
                {leaveRequests && leaveRequests.length > 0 ? (
                  <table className="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="py-3 px-4 text-left text-gray-600 font-semibold">Type</th>
                        <th className="py-3 px-4 text-left text-gray-600 font-semibold">From</th>
                        <th className="py-3 px-4 text-left text-gray-600 font-semibold">To</th>
                        <th className="py-3 px-4 text-left text-gray-600 font-semibold">Days</th>
                        <th className="py-3 px-4 text-left text-gray-600 font-semibold">Reason</th>
                        <th className="py-3 px-4 text-left text-gray-600 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {leaveRequests.map((request, index) => (
                        <tr key={request._id || index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="py-3 px-4 text-gray-800 capitalize">{request.leave_type || request.type || "N/A"}</td>
                          <td className="py-3 px-4">{formatDate(request.start_date)}</td>
                          <td className="py-3 px-4">{formatDate(request.end_date)}</td>
                          <td className="py-3 px-4">{request.days || calculateDays(request.start_date, request.end_date, request.half_day)}</td>
                          <td className="py-3 px-4">
                            <div className="max-w-xs overflow-hidden text-ellipsis whitespace-nowrap" title={request.reason}>
                              {request.reason || "N/A"}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(request.status)}`}
                            >
                              {request.status || "Unknown"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-4 text-gray-500">No leave requests found</div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default LeaveRequestsPage;
