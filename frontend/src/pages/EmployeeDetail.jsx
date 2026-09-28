import React, { useState, useEffect } from "react";
import {
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaClock,
  FaLinkedin,
  FaFacebookF,
} from "react-icons/fa";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  addMonths,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
} from "date-fns";

// SVG avatars
const MaleAvatar = () => (
  <svg viewBox="0 0 128 128" className="w-full h-full">
    <circle cx="64" cy="64" r="64" fill="#DDEAF8" /> {/* Slightly darker skin tone */}
    <ellipse cx="64" cy="64" rx="32" ry="38" fill="#6495ED" /> {/* Adjusted head shape with deeper blue */}
    <ellipse cx="64" cy="54" rx="22" ry="22" fill="#FFFFFF" /> {/* Face base */}
    <ellipse cx="64" cy="62" rx="16" ry="15" fill="#F5CBA7" /> {/* Skin tone for cheeks */}
    <ellipse cx="64" cy="90" rx="20" ry="10" fill="#6495ED" /> {/* Shoulders with deeper blue */}

    {/* Eyes - simple ovals */}
    <ellipse cx="56" cy="52" rx="3" ry="4" fill="#000000" />
    <ellipse cx="72" cy="52" rx="3" ry="4" fill="#000000" />

    {/* Mustache - curved path */}
    <path
      d="M52 60 Q64 65 76 60"
      fill="none"
      stroke="#4A2C2A"
      strokeWidth="2"
      strokeLinecap="round"
    />

    {/* Beard - rough outline */}
    <path
      d="M58 70 Q64 78 70 70 L70 80 Q64 85 58 80 Z"
      fill="#4A2C2A"
    />

    {/* Hair - angular top */}
    <path
      d="M50 30 L64 20 L78 30 L72 40 L60 40 Z"
      fill="#1976D2"
    />
  </svg>
);

const FemaleAvatar = () => (
  <svg viewBox="0 0 128 128" className="w-full h-full">
    <circle cx="64" cy="64" r="64" fill="#FCE4EC" /> {/* Background with soft pink */}
    <ellipse cx="64" cy="64" rx="34" ry="40" fill="#F48FB1" /> {/* Slightly taller head for femininity */}
    <ellipse cx="64" cy="54" rx="23" ry="23" fill="#FFFFFF" /> {/* Face base */}
    <ellipse cx="64" cy="62" rx="16" ry="15" fill="#FFE0B2" /> {/* Cheeks with blush */}

    {/* Eyes with eyelashes */}
    <ellipse cx="56" cy="52" rx="3" ry="4" fill="#000000" />
    <ellipse cx="72" cy="52" rx="3" ry="4" fill="#000000" />
    <line x1="53" y1="50" x2="50" y2="46" stroke="#000000" strokeWidth="1" />
    <line x1="55" y1="50" x2="52" y2="46" stroke="#000000" strokeWidth="1" />
    <line x1="69" y1="50" x2="66" y2="46" stroke="#000000" strokeWidth="1" />
    <line x1="71" y1="50" x2="68" y2="46" stroke="#000000" strokeWidth="1" />

    {/* Hair - flowing style */}
    <path
      d="M40 30 Q50 10 60 20 Q70 10 80 20 Q90 10 100 30 L100 60 Q90 70 80 65 Q70 70 60 65 Q50 70 40 60 Z"
      fill="#D81B60" /* Deep pink for hair */
    />

    {/* Shoulders */}
    <ellipse cx="64" cy="90" rx="22" ry="11" fill="#F48FB1" />

    {/* Optional: Small bow or accessory */}
    <path
      d="M60 40 Q62 35 64 40 Q66 35 68 40 L66 45 Q64 48 62 45 Z"
      fill="#D81B60"
    />
  </svg>
);

export default function EmployeeDetail() {
  const [activeTab, setActiveTab] = useState("Personal");
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Edit mode state
  const [editGeneral, setEditGeneral] = useState(false);
  const [generalForm, setGeneralForm] = useState({
    name: "",
    email: "",
    phone: "",
    position: "",
    salary: "",
    location: "",
    date_of_joining: "",
    shift: "",
    gender: "", // <-- add this line
  });
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const navigate = useNavigate();
  const { id } = useParams();
  const API_BASE_URL = "https://cubehis.avopay.pro:5000";

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${API_BASE_URL}/api/staff/${id}/history`,
          { timeout: 5000 }
        );
        if (!response.data) throw new Error("No data returned from the server");
        setEmployee(response.data);
        setGeneralForm({
          name: response.data.name || "",
          email: response.data.email || "",
          phone: response.data.phone || "",
          position: response.data.position || "",
          salary: response.data.salary || "",
          location: response.data.location || "",
          date_of_joining: response.data.date_of_joining || response.data.generalInfo?.joiningDate || "",
          shift: response.data.shift || response.data.generalInfo?.shift || "",
          gender: response.data.gender || response.data.generalInfo?.gender || "",
        });
        setLoading(false);
      } catch (err) {
        console.error("API Error:", err);
        setError(
          err.response?.status === 404
            ? `Employee with ID ${id} not found. Please verify the employee ID is correct or check if the employee exists in the system.`
            : `Failed to fetch employee data: ${err.message}${err.response?.data?.detail
              ? ` - ${err.response.data.detail}`
              : ""
            }`
        );
        setLoading(false);
        setEmployee(null);
      }
    };
    fetchEmployee();
    // eslint-disable-next-line
  }, [id]);

  // Attendance Data for Calendar
  const attendanceData = {};
  (employee?.attendance || []).forEach((record) => {
    if (record.date && record.status) {
      attendanceData[record.date] = record.status;
    }
  });

  // Calendar Card (responsive and user-friendly)
  const renderCalendarCard = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const joiningDate = employee?.date_of_joining || employee?.generalInfo?.joiningDate;

    const weeks = [];
    let day = startDate;

    while (day <= endDate) {
      const days = [];
      for (let i = 0; i < 7; i++) {
        const formattedDate = format(day, "yyyy-MM-dd");
        const inCurrentMonth = isSameMonth(day, monthStart);
        const isToday = isSameDay(day, new Date());
        const isDJ = joiningDate && isSameDay(new Date(joiningDate), day);
        const afterDJ = joiningDate && new Date(formattedDate) >= new Date(joiningDate);
        const attendance = attendanceData[formattedDate];

        let cellClasses = "w-8 h-8 flex items-center justify-center rounded-full mx-auto font-semibold border text-xs cursor-pointer hover:bg-gray-100 transition-colors";
        let cellContent = format(day, "d");

        if (!inCurrentMonth) {
          cellClasses += " bg-gray-100 text-gray-300 border-transparent";
        } else if (!afterDJ) {
          cellClasses += " bg-gray-50 text-gray-300 border-transparent";
        } else if (isDJ) {
          cellClasses += " border-2 border-blue-500 text-blue-700 bg-blue-50";
          cellContent = (
            <span title="Date of Joining">
              {format(day, "d")}
              <span className="block text-[8px] text-blue-500 font-bold">DJ</span>
            </span>
          );
        } else if (attendance === "Present") {
          cellClasses += " bg-green-100 text-green-700 border-green-200";
        } else if (attendance === "Absent") {
          cellClasses += " bg-red-100 text-red-700 border-red-200";
        } else if (isToday) {
          cellClasses += " bg-cyan-700 text-white border-cyan-800";
        } else {
          cellClasses += " text-gray-700 border-transparent";
        }

        days.push(
          <td key={formattedDate} className="p-1">
            <div className={cellClasses} title={isDJ ? "Date of Joining" : attendance ? `${attendance} (${formattedDate})` : formattedDate}>
              {cellContent}
            </div>
          </td>
        );
        day = addDays(day, 1);
      }
      weeks.push(<tr key={format(addDays(day, -7), "yyyy-MM-dd")}>{days}</tr>);
    }

    return (
      <div className="bg-white rounded-xl shadow-lg px-6 py-8 flex flex-col items-center w-full max-w-md mx-auto lg:mx-0 h-full min-h-[340px]">
        <div className="flex items-center justify-between mb-3 w-full">
          <button
            className="text-gray-400 hover:text-cyan-600 text-xl sm:text-2xl p-1 rounded-full hover:bg-gray-100 transition"
            title="Previous month"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            &lt;
          </button>
          <h3 className="font-bold text-gray-700 text-sm sm:text-base uppercase">
            {format(currentMonth, "MMMM yyyy")}
          </h3>
          <button
            className="text-gray-400 hover:text-cyan-600 text-xl sm:text-2xl p-1 rounded-full hover:bg-gray-100 transition"
            title="Next month"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            &gt;
          </button>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-center">
            <thead>
              <tr className="text-gray-500 text-xs sm:text-sm">
                <th>Sun</th>
                <th>Mon</th>
                <th>Tue</th>
                <th>Wed</th>
                <th>Thu</th>
                <th>Fri</th>
                <th>Sat</th>
              </tr>
            </thead>
            <tbody>{weeks}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-4 mt-3 justify-center text-xs sm:text-sm">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-100 border border-green-400"></span>
            Present
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-100 border border-red-400"></span>
            Absent
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border-2 border-blue-500 bg-blue-50"></span>
            Date of Joining
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-700 border border-cyan-800"></span>
            Today
          </span>
        </div>
      </div>
    );
  };

  // Profile Header
  const renderProfileHeader = () => {
    const socialLinks = [
      { href: "https://www.linkedin.com/", icon: <FaLinkedin />, bg: "#0077b5", hoverBg: "#005983" },
      { href: "https://www.facebook.com/", icon: <FaFacebookF />, bg: "#4267B2", hoverBg: "#284e87" },
    ];

    return (
      <div className="flex flex-col lg:flex-row gap-6 items-stretch w-full">
        {/* Profile Card */}
        <div className="bg-white rounded-xl shadow-lg px-6 py-8 flex flex-col items-center w-full max-w-md mx-auto lg:mx-0 lg:w-[45%] h-full min-h-[340px]">
          {/* Avatar - centered */}
          <div className="relative flex flex-col items-center mb-3">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-lg bg-gray-200 flex items-center justify-center">
              {(() => {
                const gender = employee?.gender || employee?.generalInfo?.gender || "";
                if (gender.toLowerCase() === "male") return <MaleAvatar />;
                if (gender.toLowerCase() === "female") return <FemaleAvatar />;
                // You can add a NeutralAvatar here if you have one, or fallback to MaleAvatar
                return <MaleAvatar />;
              })()}
            </div>

          </div>
          {/* Horizontal Line */}
          <div className="w-full flex justify-center mb-2">
            <hr className="border-t-2 border-cyan-100 w-16" />
          </div>
          {/* Profile Info - centered */}
          <div className="flex flex-col items-center w-full">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-2xl text-cyan-900">{employee?.name || "-"}</span>
              <span className="bg-cyan-100 text-cyan-700 text-xs font-semibold px-3 py-1 rounded-full">Active</span>
            </div>
            <div className="text-gray-600 mb-3 flex flex-col items-center gap-1">
              <div>
                <b>Position:</b> {employee?.position || "-"}
              </div>
              <div>
                <b>Shift:</b> {employee?.shift || "-"}
              </div>
            </div>
            <div className="flex flex-col items-center text-sm text-gray-700 space-y-1 mb-3">
              <div className="flex items-center gap-2">
                <FaEnvelope className="text-gray-400" />
                {/* <span>{employee?.email || "-"}</span> */}
                <span>  {employee?.email ? (
                  <a
                    href={`mailto:${employee.email}`}
                    className="text-blue-700 hover:underline hover:text-cyan-900 transition"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {employee.email}
                  </a>
                ) : (
                  <span>-</span>
                )}</span>

              </div>
              <div className="flex items-center gap-2">
                <FaPhone className="text-gray-400" />
                <span>{employee?.phone || "-"}</span>
              </div>
              <div className="flex items-center gap-2">
                <FaMapMarkerAlt className="text-gray-400" />
                <span>{employee?.location || "-"}</span>
              </div>
            </div>
            {/* Social Links */}
            <div className="flex gap-3 mt-2">
              {socialLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full p-2 text-white text-lg hover:shadow"
                  style={{ backgroundColor: link.bg }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = link.hoverBg)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = link.bg)}
                >
                  {link.icon}
                </a>
              ))}
            </div>
          </div>
        </div>
        {/* Calendar Card */}
        <div className="w-full max-w-md mx-auto lg:mx-0 lg:w-[55%] h-full min-h-[340px] flex items-stretch justify-end">
          {renderCalendarCard()}
        </div>
      </div>
    );
  };

  // Personal Tab
  const renderPersonalTab = () => (
    <div className="space-y-8">
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="font-semibold text-lg">General Information</span>
          {editGeneral ? (
            <span className="text-green-600 text-sm">Editing...</span>
          ) : (
            <button
              className="text-white bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 "
              onClick={() => setEditGeneral(true)}
            >
              Edit
            </button>
          )}
        </div>
        <form
          className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4"
          onSubmit={async e => {
            e.preventDefault();
            try {
              // PATCH request to update employee in backend
              await axios.patch(
                `${API_BASE_URL}/api/staff/${id}/`,
                {
                  name: generalForm.name,
                  email: generalForm.email,
                  phone: generalForm.phone,
                  position: generalForm.position,
                  salary: generalForm.salary,
                  location: generalForm.location,
                  date_of_joining: generalForm.date_of_joining,
                  shift: generalForm.shift,
                  gender: generalForm.gender, // <-- add this line
                }
              );
              setEditGeneral(false);
              setEmployee(prev => ({
                ...prev,
                ...generalForm,
              }));
              setShowSuccessModal(true); // Show modal on success
            } catch (err) {
              alert("Failed to update employee: " + (err.response?.data?.detail || err.message));
            }
          }}
        >
          {/* Name */}
          <div>
            <div className="text-sm font-medium mb-1">Name</div>
            {editGeneral ? (
              <input
                name="name"
                className="border rounded px-2 py-2 w-full focus:ring-2 focus:ring-cyan-500 transition"
                value={generalForm.name}
                onChange={e => setGeneralForm({ ...generalForm, name: e.target.value })}
                required
              />
            ) : (
              <div className="border rounded px-2 py-2 bg-gray-50">{employee?.name || "-"}</div>
            )}
          </div>
          {/* Email */}
          <div>
            <div className="text-sm font-medium mb-1">Email</div>
            {editGeneral ? (
              <input
                name="email"
                type="email"
                className="border rounded px-2 py-2 w-full focus:ring-2 focus:ring-cyan-500 transition"
                value={generalForm.email}
                onChange={e => setGeneralForm({ ...generalForm, email: e.target.value })}
                required
              />
            ) : (
              <div className="border rounded px-2 py-2 bg-gray-50">{employee?.email || "-"}</div>
            )}
          </div>
          {/* Phone */}
          <div>
            <div className="text-sm font-medium mb-1">Phone</div>
            {editGeneral ? (
              <input
                name="phone"
                type="tel"
                className="border rounded px-2 py-2 w-full focus:ring-2 focus:ring-cyan-500 transition"
                value={generalForm.phone}
                onChange={e => setGeneralForm({ ...generalForm, phone: e.target.value })}
                required
              />
            ) : (
              <div className="border rounded px-2 py-2 bg-gray-50">{employee?.phone || "-"}</div>
            )}
          </div>
          {/* Position */}
          <div>
            <div className="text-sm font-medium mb-1">Position</div>
            {editGeneral ? (
              <input
                name="position"
                className="border rounded px-2 py-2 w-full focus:ring-2 focus:ring-cyan-500 transition"
                value={generalForm.position}
                onChange={e => setGeneralForm({ ...generalForm, position: e.target.value })}
                required
              />
            ) : (
              <div className="border rounded px-2 py-2 bg-gray-50">{employee?.position || "-"}</div>
            )}
          </div>
          {/* Salary */}
          <div>
            <div className="text-sm font-medium mb-1">Salary</div>
            {editGeneral ? (
              <input
                name="salary"
                type="number"
                className="border rounded px-2 py-2 w-full focus:ring-2 focus:ring-cyan-500 transition"
                value={generalForm.salary}
                onChange={e => setGeneralForm({ ...generalForm, salary: e.target.value })}
                required
              />
            ) : (
              <div className="border rounded px-2 py-2 bg-gray-50">{employee?.salary || "-"}</div>
            )}
          </div>
          {/* Location */}
          <div>
            <div className="text-sm font-medium mb-1">Location</div>
            {editGeneral ? (
              <input
                name="location"
                className="border rounded px-2 py-2 w-full focus:ring-2 focus:ring-cyan-500 transition"
                value={generalForm.location}
                onChange={e => setGeneralForm({ ...generalForm, location: e.target.value })}
              />
            ) : (
              <div className="border rounded px-2 py-2 bg-gray-50">{employee?.location || "-"}</div>
            )}
          </div>
          {/* Date of Joining */}
          <div>
            <div className="text-sm font-medium mb-1">Date of Joining</div>
            {editGeneral ? (
              <input
                name="date_of_joining"
                type="date"
                className="border rounded px-2 py-2 w-full focus:ring-2 focus:ring-cyan-500 transition"
                value={generalForm.date_of_joining}
                onChange={e => setGeneralForm({ ...generalForm, date_of_joining: e.target.value })}
                required
              />
            ) : (
              <div className="border rounded px-2 py-2 bg-gray-50">
                {employee?.date_of_joining || employee?.generalInfo?.joiningDate || "-"}
              </div>
            )}
          </div>
          {/* Shift */}
          <div>
            <div className="text-sm font-medium mb-1">Shift</div>
            {editGeneral ? (
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="shift"
                    value="9am - 6pm"
                    checked={generalForm.shift === "9am - 6pm"}
                    onChange={e => setGeneralForm({ ...generalForm, shift: e.target.value })}
                    required
                  />
                  9am - 6pm
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="shift"
                    value="10am - 7pm"
                    checked={generalForm.shift === "10am - 7pm"}
                    onChange={e => setGeneralForm({ ...generalForm, shift: e.target.value })}
                    required
                  />
                  10am - 7pm
                </label>
              </div>
            ) : (
              <div className="border rounded px-2 py-2 bg-gray-50">
                {employee?.shift || "-"}
              </div>
            )}
          </div>
          {/* Gender */}
          <div>
            <div className="text-sm font-medium mb-1">Gender</div>
            {editGeneral ? (
              <select
                name="gender"
                className="border rounded px-2 py-2 w-full focus:ring-2 focus:ring-cyan-500 transition"
                value={generalForm.gender}
                onChange={e => setGeneralForm({ ...generalForm, gender: e.target.value })}
                required
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            ) : (
              <div className="border rounded px-2 py-2 bg-gray-50">{employee?.gender || employee?.generalInfo?.gender || "-"}</div>
            )}
          </div>
          {/* Save/Cancel buttons */}
          {editGeneral && (
            <div className="col-span-2 flex gap-3 mt-4">
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition"
              >
                Save
              </button>
              <button
                type="button"
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded hover:bg-gray-300 transition"
                onClick={() => {
                  setEditGeneral(false);
                  setGeneralForm({
                    name: employee?.name || "",
                    email: employee?.email || "",
                    phone: employee?.phone || "",
                    position: employee?.position || "",
                    salary: employee?.salary || "",
                    location: employee?.location || "",
                    date_of_joining: employee?.date_of_joining || employee?.generalInfo?.joiningDate || "",
                    shift: employee?.shift || employee?.generalInfo?.shift || "",
                    gender: employee?.gender || employee?.generalInfo?.gender || "", // <-- add this line
                  });
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );



  // Documents Tab
  const renderDocumentsTab = () => (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">Documents</h2>
      {(employee?.documents || []).length === 0 ? (
        <div className="text-gray-400">No documents uploaded.</div>
      ) : (
        <ul className="list-disc pl-6">
          {employee.documents.map((doc, idx) => {
            const isAbsolute = /^https?:\/\//i.test(doc.url);
            const fileUrl = isAbsolute ? doc.url : `${API_BASE_URL}${doc.url}`;
            return (
              <li key={idx} className="mb-2">
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-700 underline hover:text-cyan-900 transition"
                >
                  {doc.name}
                </a>
                <span className="ml-2 text-gray-500 text-xs">
                  (Uploaded: {doc.uploaded || "-"})
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  // Leaves Tab
  const renderLeavesTab = () => (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">Leaves</h2>
      {(employee?.leaves || []).length === 0 ? (
        <div className="text-gray-400">No leave records found.</div>
      ) : (
        <table className="w-full text-left table-auto border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 text-xs sm:text-sm">Start</th>
              <th className="px-4 py-2 text-xs sm:text-sm">End</th>
              <th className="px-4 py-2 text-xs sm:text-sm">Status</th>
              <th className="px-4 py-2 text-xs sm:text-sm">Reason</th>
            </tr>
          </thead>
          <tbody>
            {employee.leaves.map((leave, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition">
                <td className="px-4 py-2 text-xs sm:text-sm">{leave.start_date}</td>
                <td className="px-4 py-2 text-xs sm:text-sm">{leave.end_date}</td>
                <td className="px-4 py-2 text-xs sm:text-sm">{leave.status}</td>
                <td className="px-4 py-2 text-xs sm:text-sm">{leave.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  // Attendance Tab
  const renderAttendanceTab = () => (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">Attendance</h2>
      {(employee?.attendance || []).length === 0 ? (
        <div className="text-gray-400">No attendance records found.</div>
      ) : (
        <table className="w-full text-left table-auto border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 text-xs sm:text-sm">Date</th>
              <th className="px-4 py-2 text-xs sm:text-sm">Status</th>
            </tr>
          </thead>
          <tbody>
            {employee.attendance.map((a, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition">
                <td className="px-4 py-2 text-xs sm:text-sm">{a.date}</td>
                <td className="px-4 py-2 text-xs sm:text-sm">{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600 text-lg">Loading...</div>
      </div>
    );
  }

  if (error || !employee || !employee.employee_id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-600 mb-2">Employee Not Found</h2>
          <p className="text-gray-700 mb-6">{error || "No employee data available."}</p>

          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Try accessing a different employee ID:</p>
            <div className="flex gap-2 justify-center">
              {["EMP-000001", "EMP-000002", "EMP-000003"].map((empId) => (
                <button
                  key={empId}
                  className="bg-cyan-100 text-cyan-700 px-3 py-1 rounded hover:bg-cyan-200 transition text-sm"
                  onClick={() => navigate(`/employees/${empId}`)}
                >
                  {empId}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              className="bg-cyan-600 text-white px-4 py-2 rounded hover:bg-cyan-700 transition"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
            <button
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition"
              onClick={() => navigate("/employees")}
            >
              Back to Employee List
            </button>
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
              onClick={() => navigate("/")}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabs = (employee.tabs || ["Personal", "Documents", "Leaves", "Attendance"]).filter(
    (tab) => tab !== "Salary" && tab !== "Asset"
  );

  return (
    <div className="min-h-screen  to-blue-100 font-sans flex flex-col items-center py-6 px-4 sm:px-6">
      <div className="w-full max-w-5xl mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-cyan-700 hover:text-white hover:bg-cyan-600 bg-white border border-cyan-200 rounded-full px-4 py-2 shadow transition font-semibold"
        >
          <span className="text-xl">←</span> Back
        </button>
      </div>
      <div className="w-full max-w-5xl">{renderProfileHeader()}</div>
      <div className="w-full mt-3 max-w-5xl bg-white rounded-xl shadow-lg p-2 sm:p-4">
        {/* Tabs */}
        <div className="flex flex-wrap gap-0 mb-4  sm:mb-6 rounded-xl overflow-hidden shadow border border-cyan-100 bg-cyan-50">
          {tabs.map((tab, idx) => (
            <button
              key={tab}
              className={`flex-1 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-colors duration-200 focus:outline-none
          ${activeTab === tab
                  ? "bg-white text-cyan-700 border-b-4 border-cyan-600"
                  : "text-gray-500 hover:text-cyan-700 bg-cyan-50"}
          ${idx === 0 ? "rounded-l-xl" : ""}
          ${idx === tabs.length - 1 ? "rounded-r-xl" : ""}
        `}
              style={{ minWidth: "120px" }}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        {/* Tab Content */}
        <div className="pt-2">
          {activeTab === "Personal" && renderPersonalTab()}
          {activeTab === "Documents" && renderDocumentsTab()}
          {activeTab === "Leaves" && renderLeavesTab()}
          {activeTab === "Attendance" && renderAttendanceTab()}
        </div>
      </div>
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center max-w-xs w-full">
            <div className="text-green-600 text-3xl mb-2">✔</div>
            <div className="font-semibold text-lg mb-2 text-center">Update Successful</div>
            <div className="text-gray-600 mb-4 text-center">Employee information updated successfully.</div>
            <button
              className="bg-cyan-600 text-white px-6 py-2 rounded hover:bg-cyan-700 transition"
              onClick={() => setShowSuccessModal(false)}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}