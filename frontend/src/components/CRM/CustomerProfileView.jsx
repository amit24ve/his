// Fetch communication logs for a customer
async function getCommunicationLogs(customer_id) {
  try {
    const res = await fetch(`${API_BASE}/${customer_id}/communication`);
    if (!res.ok) throw new Error(`Failed to fetch communication logs: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error("Error fetching communication logs:", error);
    throw error;
  }
}
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE = "https://cubehis.avopay.pro:5000/api/customers";
const sectionCard =
  "bg-gray-100 rounded-xl shadow border p-5 mb-4 flex flex-col gap-5";

// Helper functions for customer API endpoints
async function getCustomerProfile(customer_id) {
  try {
    const res = await fetch(`${API_BASE}/${customer_id}`);
    if (!res.ok) throw new Error(`Failed to fetch customer: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error("Error fetching customer profile:", error);
    throw error;
  }
}

async function getCustomerHistory(customer_id) {
  try {
    const res = await fetch(`${API_BASE}/${customer_id}/history`);
    if (!res.ok) throw new Error(`Failed to fetch customer history: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error("Error fetching customer history:", error);
    throw error;
  }
}

async function addCustomerNote(customer_id, content) {
  try {
    const res = await fetch(`${API_BASE}/${customer_id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        created_at: new Date().toISOString()
      }),
    });
    if (!res.ok) throw new Error(`Failed to add note: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error("Error adding customer note:", error);
    throw error;
  }
}

async function addCommunicationLog(customer_id, channel, message, by = "User") {
  try {
    const res = await fetch(`${API_BASE}/${customer_id}/communication`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel,
        message,
        by,
        time: new Date().toISOString()
      }),
    });
    if (!res.ok) throw new Error(`Failed to add communication log: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error("Error adding communication log:", error);
    throw error;
  }
}

async function addCustomerFeedback(customer_id, rating, comment) {
  try {
    const res = await fetch(`${API_BASE}/${customer_id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating,
        comment,
        date: new Date().toISOString()
      }),
    });
    if (!res.ok) throw new Error(`Failed to add feedback: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error("Error adding customer feedback:", error);
    throw error;
  }
}

async function updateCustomerLoyalty(customer_id, points, reason) {
  try {
    const res = await fetch(`${API_BASE}/${customer_id}/loyalty`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        points,
        reason,
        date: new Date().toISOString()
      }),
    });
    if (!res.ok) throw new Error(`Failed to update loyalty points: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error("Error updating loyalty points:", error);
    throw error;
  }
}

const dummyProducts = [
  {
    id: 1,
    name: "INSTYLE Golden Oud I Eau de Parfum",
    price: 1999,
    stock: false,
    image: "https://rukminim1.flixcart.com/image/612/612/xif0q/perfume/k/t/w/-original-imagx9kzjy6k8azw.jpeg?q=70"
  },
  {
    id: 2,
    name: "N AND J Solid Men Polo Neck White T-Shirt",
    price: 999,
    stock: false,
    image: "https://rukminim1.flixcart.com/image/612/612/xif0q/t-shirt/j/s/s/l-tshirt-1001-n-and-j-original-imagw6y2b8fgzzxz.jpeg?q=70"
  },
  {
    id: 3,
    name: "Product C",
    price: 299,
    stock: true,
    image: ""
  }
];


async function createTicket({ user_id, subject, description }) {
  const res = await fetch("https://cubehis.avopay.pro:5000/api/tickets/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id,
      subject,
      description
    }),
  });
  if (!res.ok) throw new Error("Failed to create ticket");
  return res.json();
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString();
}

export default function CustomerProfileView() {
  const { customer_id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Payments");
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaintSubject, setComplaintSubject] = useState("");
  const [complaintDesc, setComplaintDesc] = useState("");
  const [creatingComplaint, setCreatingComplaint] = useState(false);

  // Function to process customer history data
  const processCustomerHistory = (historyData) => {
    if (!historyData) return;

    // Process payments data if available
    if (historyData.payments) {
      setPayments(historyData.payments.map(payment => ({
        amount: payment.amount,
        date: formatDate(payment.date),
        mode: payment.mode || "Online",
        status: payment.status || "success",
        remark: payment.remark || `Order #${payment.order_id || "N/A"}`
      })));
    }

    // Process complaints data if available
    if (historyData.complaints) {
      setComplaints(historyData.complaints.map(complaint => ({
        id: complaint.id,
        subject: complaint.subject,
        description: complaint.description,
        status: complaint.status || "Open",
        date: formatDate(complaint.created_at)
      })));
    }

    // Process communication logs if available, filter out backend default placeholder
    if (historyData.communication) {
      setCommLogs(
        historyData.communication
          .filter(log => !(log.content === "No communication log found. This is a default entry." && log.agent_id === "User"))
          .map(log => ({
            id: log.id,
            customer_id: log.customer_id,
            channel: log.channel,
            direction: log.direction,
            agent_id: log.agent_id,
            by: log.by || log.agent_id || "System",
            metadata: log.metadata,
            message: log.message || log.content || "",
            time: formatDate(log.time)
          }))
      );
    }

    // Process feedback if available
    if (historyData.feedback) {
      setFeedbacks(historyData.feedback.map(feedback => ({
        id: feedback.id,
        rating: feedback.rating,
        comment: feedback.comment,
        date: formatDate(feedback.date)
      })));
    }

    // Process loyalty points if available
    if (historyData.loyalty) {
      setLoyalty({
        points: historyData.loyalty.total_points || 0,
        history: (historyData.loyalty.history || []).map(item => ({
          date: formatDate(item.date),
          change: item.change > 0 ? `+${item.change}` : `${item.change}`,
          reason: item.reason || "Transaction"
        }))
      });
    }

    // Process notes if available
    if (historyData.notes) {
      setNotes(historyData.notes.map(note => ({
        id: note.id,
        content: note.content,
        author: note.author,
        created_at: formatDate(note.created_at)
      })));
    }

  };

  // Order/Cart States
  const [selectedProductId, setSelectedProductId] = useState(dummyProducts[0]?.id || null);
  const [cart, setCart] = useState([]);
  const [savedForLater, setSavedForLater] = useState([]);
  const [orderStatus, setOrderStatus] = useState("");

  // Other tabs' states
  const [payments, setPayments] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [commLogs, setCommLogs] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loyalty, setLoyalty] = useState({ points: 0, history: [] });
  const [notes, setNotes] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);

  // Fetch customer details
  useEffect(() => {
    setLoading(true);

    // Use the helper function to get customer profile
    getCustomerProfile(customer_id)
      .then(data => {
        setCustomer(data);
        // If we successfully got the customer, also try to fetch their history
        return getCustomerHistory(customer_id)
          .then(historyData => {
            // Process history data for various tabs
            processCustomerHistory(historyData);
          })
          .catch(error => {
            console.error("Error fetching customer history:", error);
            // Continue even if history fetch fails
          });
      })
      .catch(() => {
        setCustomer(null);
        console.error("Failed to fetch customer profile");
      })
      .finally(() => setLoading(false));
  }, [customer_id]);




  // Dummy/fetch data for tabs
  useEffect(() => {
    if (activeTab === "Payments") {
      setPayments([
        { amount: 2000, date: "2025-06-05", mode: "Card", status: "success", remark: "Order #1234" },
        { amount: 1500, date: "2025-05-10", mode: "UPI", status: "pending", remark: "Order #1188" }
      ]);
    }
    if (activeTab === "Complaints") {
      setComplaints([
        { id: 1, subject: "Late Delivery", description: "Order #1234 was delivered late.", status: "Resolved", date: "2025-06-07" },
        { id: 2, subject: "Wrong Product", description: "Received a different item.", status: "Open", date: "2025-05-12" }
      ]);
    }
    if (activeTab === "Communication Log") {
      // Fetch communication logs from backend
      getCommunicationLogs(customer_id)
        .then(data => {
          // Filter out backend default placeholder log
          const filtered = Array.isArray(data)
            ? data.filter(log => !(log.content === "No communication log found. This is a default entry." && log.agent_id === "User"))
            : [];
          setCommLogs(filtered.map(log => ({
            id: log.id,
            channel: log.channel,
            message: log.message || log.content || "",
            by: log.by || log.agent_id || "System",
            time: log.time ? (typeof log.time === "string" ? log.time : new Date(log.time).toLocaleString()) : ""
          })));
        })
        .catch(() => setCommLogs([]));
    }
    if (activeTab === "Feedback") {
      // Fetch feedbacks from backend using helper and filter out default/empty feedbacks
      getCustomerFeedback(customer_id)
        .then(data => {
          const filtered = (Array.isArray(data) ? data : []).filter(fb => {
            const hasText = (fb.comment && fb.comment.trim() !== "") || (fb.content && fb.content.trim() !== "");
            const hasRating = typeof fb.rating === "number" && fb.rating > 0;
            return hasText || hasRating;
          });
          setFeedbacks(filtered);
        })
        .catch(() => setFeedbacks([]));
    }
    // Helper function to fetch customer feedbacks
    async function getCustomerFeedback(customer_id) {
      try {
        const res = await fetch(`${API_BASE}/${customer_id}/feedback`);
        if (!res.ok) throw new Error(`Failed to fetch feedback: ${res.status}`);
        return res.json();
      } catch (error) {
        console.error("Error fetching customer feedback:", error);
        throw error;
      }
    }
    if (activeTab === "Loyalty Points") {
      // Fetch loyalty points from backend
      getCustomerLoyalty(customer_id)
        .then(data => {
          setLoyalty({
            points: data.total_points || 0,
            history: (data.history || []).map(item => ({
              date: formatDate(item.date),
              change: item.change > 0 ? `+${item.change}` : `${item.change}`,
              reason: item.reason || "Transaction"
            }))
          });
        })
        .catch(() => setLoyalty({ points: 0, history: [] }));
    }
    // Helper function to fetch customer loyalty points
    async function getCustomerLoyalty(customer_id) {
      try {
        const res = await fetch(`${API_BASE}/${customer_id}/loyalty`);
        if (!res.ok) throw new Error(`Failed to fetch loyalty: ${res.status}`);
        return res.json();
      } catch (error) {
        console.error("Error fetching customer loyalty:", error);
        throw error;
      }
    }
    if (activeTab === "Notes") {
      setNotes([
        { id: 1, content: "Customer prefers weekend delivery.", author: "Amit", created_at: "2025-06-01 10:20" },
        { id: 2, content: "Verified address by call.", author: "Support", created_at: "2025-05-15 15:30" }
      ]);
    }
    if (activeTab === "Activity Logs") {
      // Fetch activity logs from backend
      getCustomerActivityLogs(customer_id)
        .then(data => {
          setActivityLogs(Array.isArray(data) ? data.map(log => ({
            id: log.id,
            action: log.action,
            details: log.details,
            user: log.user || "System",
            time: formatDate(log.time)
          })) : []);
        })
        .catch(() => setActivityLogs([]));
    }
    // Helper function to add a new activity log
    async function addCustomerActivityLog(customer_id, action, details, user = "User") {
      try {
        const res = await fetch(`${API_BASE}/${customer_id}/activity_logs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, details, user, timestamp: new Date().toISOString() })
        });
        if (!res.ok) throw new Error(`Failed to add activity log: ${res.status}`);
        return res.json();
      } catch (error) {
        console.error("Error adding activity log:", error);
        throw error;
      }
    }
    // Helper function to fetch customer activity logs
    async function getCustomerActivityLogs(customer_id) {
      try {
        const res = await fetch(`${API_BASE}/${customer_id}/activity_logs`);
        if (!res.ok) throw new Error(`Failed to fetch activity logs: ${res.status}`);
        return res.json();
      } catch (error) {
        console.error("Error fetching customer activity logs:", error);
        throw error;
      }
    }
  }, [activeTab, customer_id]);


  const handleComplaintSubmit = async (e) => {
    e.preventDefault();
    setCreatingComplaint(true);
    try {
      const ticket = await createTicket({
        user_id: customer.id,
        subject: complaintSubject,
        description: complaintDesc,
      });

      // Also add a communication log for this complaint
      await addCommunicationLog(customer_id, "Complaint", complaintDesc, "Customer");

      setComplaints(prev => [
        {
          id: ticket.id,
          subject: ticket.subject,
          description: ticket.description,
          status: ticket.status,
          date: new Date(ticket.created_at).toISOString().slice(0, 10),
        },
        ...prev,
      ]);
      setComplaintSubject("");
      setComplaintDesc("");
      setShowComplaintModal(false);
    } catch (error) {
      console.error("Failed to create complaint ticket:", error);
      alert("Failed to create complaint ticket");
    } finally {
      setCreatingComplaint(false);
    }
  };

  // Cart Actions
  const handleAddProductToCart = () => {
    const product = dummyProducts.find(p => p.id === Number(selectedProductId));
    if (!product) return;
    setCart(prev => {
      if (prev.some(p => p.id === product.id)) {
        setOrderStatus("Product already in cart!");
        setTimeout(() => setOrderStatus(""), 1500);
        return prev;
      }
      setOrderStatus("Added to cart: " + product.name);
      setTimeout(() => setOrderStatus(""), 1500);
      return [...prev, product];
    });
  };

  const handleRemoveFromCart = (id) => {
    setCart(prev => prev.filter(p => p.id !== id));
  };

  const handleSaveForLater = (id) => {
    const product = cart.find(p => p.id === id);
    if (product) {
      setSavedForLater(prev => [...prev, product]);
      setCart(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleMoveToCart = (id) => {
    const product = savedForLater.find(p => p.id === id);
    if (product) {
      setCart(prev => [...prev, product]);
      setSavedForLater(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleRemoveSaved = (id) => {
    setSavedForLater(prev => prev.filter(p => p.id !== id));
  };

  // PLACE ORDER: Only for in-stock items
  const handlePlaceOrder = async () => {
    const inStock = cart.filter(p => p.stock);
    if (inStock.length === 0) {
      setOrderStatus("No in-stock products to order.");
      setTimeout(() => setOrderStatus(""), 2000);
      return;
    }

    try {
      // Add communication log for this order
      await addCommunicationLog(
        customer_id,
        "Order",
        `Order placed for: ${inStock.map(p => p.name).join(", ")}`,
        "System"
      );

      setOrderStatus("Order placed for: " + inStock.map(p => p.name).join(", "));
      setCart(prev => prev.filter(p => !p.stock));

      // Update loyalty points for this order
      const orderTotal = inStock.reduce((total, p) => total + p.price, 0);
      const pointsEarned = Math.floor(orderTotal / 100); // 1 point per 100 units spent
      if (pointsEarned > 0) {
        await updateCustomerLoyalty(
          customer_id,
          pointsEarned,
          `Order placed for ${inStock.length} item(s)`
        );
      }

      setTimeout(() => setOrderStatus(""), 2000);
    } catch (error) {
      console.error("Error processing order:", error);
      setOrderStatus("Error processing order. Please try again.");
      setTimeout(() => setOrderStatus(""), 3000);
    }
  };

  // Cart summary
  const priceTotal = cart.reduce((acc, p) => acc + p.price, 0);
  const discount = cart.length > 0 ? 0.7 * priceTotal : 0; // Just for demo
  const coupons = cart.length > 0 ? 121 : 0; // Just for demo
  const platformFee = cart.length > 0 ? 4 : 0;
  const totalAmount = priceTotal - discount - coupons + platformFee;

  // --- UI ---
  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!customer) return <div className="p-8 text-center text-gray-500">Customer not found.</div>;

  // Avatar/profile image URL logic
  const API_BASE_URL = "https://cubehis.avopay.pro:5000";
  let imageUrl = customer?.profile_picture || customer?.avatar_url || "";
  if (imageUrl && imageUrl.startsWith("/")) {
    imageUrl = API_BASE_URL + imageUrl;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gradient-to-tr from-slate-100 via-white to-slate-100">
      {/* Sidebar */}
      <aside className="bg-white w-full md:max-w-xs px-4 sm:px-8 py-10 border-b md:border-b-0 md:border-r border-gray-100 flex-shrink-0 flex flex-col items-center shadow-none">
        <button
          className="mb-8 px-5 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 text-gray-800 font-semibold shadow transition flex items-center gap-2"
          onClick={() => navigate(-1)}
        >
          <span className="text-lg">←</span> Back to Customers
        </button>
        <div className="flex flex-col items-center mb-8 w-full">
          <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-white-100 via-blue-200 to-blue-300 overflow-hidden mb-4 shadow-inner flex  border-2 border-blue-300 items-center justify-center">
            {imageUrl ? (
              <img src={imageUrl} alt="avatar" className="object-cover w-full h-full" />
            ) : (
              <span className="w-full h-full flex items-center justify-center font-bold text-4xl  text-black-400 select-none">
                {(customer.name?.[0] || "") + (customer.full_name?.[0] || "")}
              </span>
            )}
          </div>
          <div className="text-2xl font-extrabold text-gray-900 mb-1 text-center break-words tracking-tight">
            {customer.name} {customer.full_name}
          </div>
          <span className="rounded-full px-3 py-1 bg-blue-100 text-blue-600 text-m font-semibold mt-1 mb-0 select-all">
            {customer.id}
          </span>
        </div>
        <section className="w-full">
          <h3 className="text-lg text-gray-800 font-bold mb-3 tracking-tight">Contact Info</h3>
          <div className="space-y-3">
            <div>
              <span className="font-semibold text-gray-600 block">Phone</span>
              <a href={`tel:${customer.phone}`} className="text-blue-700 hover:underline break-all text-base font-medium">
                {customer.phone}
              </a>
            </div>
            <div>
              <span className="font-semibold text-gray-600 block">Email</span>
              <a href={`mailto:${customer.email}`} className="text-blue-700 hover:underline break-all text-base font-medium">
                {customer.email}
              </a>
            </div>
            <div>
              <span className="font-semibold text-gray-600 block">Address</span>
              <span className="text-base text-gray-800 break-all">{customer.address || <span className="italic text-gray-400">N/A</span>}</span>
            </div>
            {customer.age && (
              <div>
                <span className="font-semibold text-gray-600 block">Age</span>
                <span className="text-base text-gray-800">{customer.age}</span>
              </div>
            )}
            {customer.date_of_birth && (
              <div>
                <span className="font-semibold text-gray-600 block">Date of Birth</span>
                <span className="text-base text-gray-800">{formatDate(customer.date_of_birth)}</span>
              </div>
            )}
            <div>
              <span className="font-semibold text-gray-600 block">Status</span>
              <span className={`font-bold text-base ${customer.status?.toLowerCase() === "active"
                ? "text-green-600"
                : "text-gray-700"
                }`}>
                {customer.status}
              </span>
            </div>
            {customer.joined_on && (
              <div>
                <span className="font-semibold text-gray-600 block">Joined</span>
                <span className="text-base text-gray-800">{formatDate(customer.joined_on)}</span>
              </div>
            )}
          </div>
        </section>
      </aside>
      {/* Main Content */}
      <main className="flex-1 flex flex-col px-2 py-4 xs:px-2 sm:px-6 md:px-12 gap-6">
        <nav className="flex gap-3 ml-[50px] mt-2 mb-8 flex-nowrap overflow-x-auto whitespace-nowrap border-b border-gray-100 pb-2">
          {[
            "Payments",
            "Complaints",
            "Communication Log",
            "Feedback",
            "Loyalty Points"
          ].map((tab) => (
            <button
              key={tab}
              className={`px-5 py-2 rounded-xl text-base font-semibold transition-all duration-150
                ${activeTab === tab
                  ? "bg-blue-600 text-white shadow"
                  : "bg-white text-gray-700 hover:bg-blue-50 border border-gray-200"
                }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>
        {/* Payments Tab */}
        {activeTab === "Payments" && (
          <section className={sectionCard + " w-[600px] h-[380px] mx-auto"}>
            <h3 className="font-bold text-xl mb-5 text-gray-900 tracking-tight">Payments</h3>
            <div className="overflow-auto rounded-lg border border-gray-100 shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-3">Amount</th>
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left py-2 px-3">Mode</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center text-gray-400 py-6">
                        No payments found.
                      </td>
                    </tr>
                  )}
                  {payments.map((pay, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3 font-medium text-blue-800">₹{pay.amount}</td>
                      <td className="py-2 px-3">{pay.date}</td>
                      <td className="py-2 px-3">{pay.mode}</td>
                      <td className={`py-2 px-3 font-semibold ${pay.status === "success" ? "text-green-700" :
                        pay.status === "pending" ? "text-yellow-700" : "text-gray-700"
                        }`}>
                        {pay.status}
                      </td>
                      <td className="py-2 px-3">{pay.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {/* Complaints Tab */}
        {/* {activeTab === "Complaints" && (
          <section className={`${sectionCard} w-full max-w-2xl mx-auto`}>
            <h3 className="font-bold text-xl mb-5 text-gray-900 tracking-tight">Complaints</h3>
            <ul className="divide-y">
              {complaints.length === 0 && (
                <li className="text-gray-400 py-4">No complaints found.</li>
              )}
              {complaints.map(c => (
                <li key={c.id} className="py-4">
                  <div className="font-semibold text-gray-800">{c.subject}</div>
                  <div className="text-sm text-gray-500">{c.description}</div>
                  <div className="flex gap-2 mt-1 text-xs">
                    <span className="bg-gray-100 px-2 py-0.5 rounded">{c.date}</span>
                    <span className={`px-2 py-0.5 rounded ${
                      c.status === "Resolved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                    }`}>{c.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )} */}

        {activeTab === "Complaints" && (
          <section className={sectionCard + " w-[600px] h-[380px] mx-auto"}>
            <h3 className="font-bold text-xl mb-5 text-gray-900 tracking-tight">
              Complaints
            </h3>
            <button
              className="mb-4 px-4 py-2 bg-blue-600 text-white rounded font-semibold"
              onClick={() => setShowComplaintModal(true)}
            >
              Raise Complaint
            </button>
            <ul className="divide-y">
              {complaints.length === 0 && (
                <li className="text-gray-400 py-4">No complaints found.</li>
              )}
              {complaints.map(c => (
                <li key={c.id} className="py-4">
                  <div className="font-semibold text-gray-800">{c.subject}</div>
                  <div className="text-sm text-gray-500">{c.description}</div>
                  <div className="flex gap-2 mt-1 text-xs">
                    <span className="bg-gray-100 px-2 py-0.5 rounded">{c.date}</span>
                    <span className={`px-2 py-0.5 rounded ${c.status === "Resolved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}>{c.status}</span>
                  </div>
                </li>
              ))}
            </ul>
            {/* Complaint Modal */}
            {showComplaintModal && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
                <form
                  className="bg-white p-8 rounded shadow-md w-[95vw] max-w-md flex flex-col gap-4"
                  onSubmit={handleComplaintSubmit}
                >
                  <h4 className="font-bold text-lg mb-2">Raise Complaint Ticket</h4>
                  <input
                    className="border px-3 py-2 rounded"
                    placeholder="Subject"
                    value={complaintSubject}
                    onChange={e => setComplaintSubject(e.target.value)}
                    required
                  />
                  <textarea
                    className="border px-3 py-2 rounded"
                    placeholder="Description"
                    value={complaintDesc}
                    onChange={e => setComplaintDesc(e.target.value)}
                    rows={3}
                    required
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 bg-gray-300 rounded"
                      onClick={() => setShowComplaintModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded font-semibold"
                      disabled={creatingComplaint}
                    >
                      {creatingComplaint ? "Creating..." : "Create Ticket"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>
        )}
        {/* Communication Log Tab */}
        {activeTab === "Communication Log" && (
          <section className={sectionCard + " w-[600px] h-[380px] mx-auto"}>
            <h3 className="font-bold text-xl mb-5 text-gray-900 tracking-tight">Communication Log</h3>

            {/* Communication log form */}
            <form
              className="mb-4 flex flex-col gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target;
                const channel = form.channel.value;
                const message = form.message.value.trim();
                const by = form.by.value;

                if (!channel || !message) return;

                try {
                  const newLog = await addCommunicationLog(customer_id, channel, message, by);
                  setCommLogs(prev => [
                    {
                      id: newLog.id || Date.now(),
                      channel,
                      message,
                      by,
                      time: formatDate(new Date())
                    },
                    ...prev
                  ]);
                  form.message.value = "";
                } catch (error) {
                  console.error("Error adding communication log:", error);
                  alert("Failed to add communication log");
                }
              }}
            >
              <div className="flex gap-3">
                <div className="w-1/3">
                  <select
                    name="channel"
                    className="w-full border rounded px-2 py-1"
                    defaultValue="Email"
                  >
                    <option value="Email">Email</option>
                    <option value="Call">Phone Call</option>
                    <option value="SMS">SMS</option>
                    <option value="Meeting">In-person</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="w-1/3">
                  <select
                    name="by"
                    className="w-full border rounded px-2 py-1"
                    defaultValue="User"
                  >
                    <option value="User">User</option>
                    <option value="Customer">Customer</option>
                    <option value="Support">Support</option>
                    <option value="System">System</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  name="message"
                  className="flex-1 border rounded px-3 py-2"
                  placeholder="Message details..."
                  required
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded font-medium whitespace-nowrap"
                >
                  Add Log
                </button>
              </div>
            </form>

            <ul className="divide-y max-h-[200px] overflow-y-auto">
              {commLogs.length === 0 && (
                <li className="text-gray-400 py-4">No communication logs found.</li>
              )}
              {commLogs.map(log => (
                <li key={log.id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="font-semibold text-blue-700">{log.channel}</span>
                  <span className="text-gray-800">{log.message}</span>
                  <span className="text-xs text-gray-500 ml-auto">{log.by}, {log.time}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {/* Feedback Tab */}
        {activeTab === "Feedback" && (
          <section className={sectionCard + " w-[600px] h-[380px] mx-auto"}>
            <h3 className="font-bold text-xl mb-5 text-gray-900 tracking-tight">Feedback</h3>

            {/* Feedback form */}
            <form
              className="mb-4 border-b pb-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target;
                const rating = parseInt(form.rating.value);
                const comment = form.comment.value.trim();

                if (!rating || !comment) return;

                try {
                  const newFeedback = await addCustomerFeedback(customer_id, rating, comment);
                  setFeedbacks(prev => [
                    {
                      id: newFeedback.id || Date.now(),
                      rating,
                      comment,
                      date: formatDate(new Date())
                    },
                    ...prev
                  ]);
                  form.comment.value = "";
                  form.rating.value = "5";
                } catch (error) {
                  console.error("Error adding feedback:", error);
                  alert("Failed to add feedback");
                }
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <label className="font-medium">Rating:</label>
                <select
                  name="rating"
                  className="border rounded px-2 py-1"
                  defaultValue="5"
                >
                  <option value="5">5 - Excellent</option>
                  <option value="4">4 - Good</option>
                  <option value="3">3 - Average</option>
                  <option value="2">2 - Below Average</option>
                  <option value="1">1 - Poor</option>
                </select>
              </div>

              <textarea
                name="comment"
                placeholder="Enter feedback comment"
                className="w-full border rounded px-3 py-2 mb-3"
                rows="2"
                required
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded font-medium"
              >
                Add Feedback
              </button>
            </form>

            <ul className="divide-y max-h-[180px] overflow-y-auto">
              {feedbacks.length === 0 && (
                <li className="text-gray-400 py-4">No feedback given.</li>
              )}
              {feedbacks.map(f => (
                <li key={f.id} className="py-4 flex flex-col gap-1">
                  <div>
                    <span className="inline-block bg-yellow-100 text-yellow-800 rounded px-2 py-0.5 font-bold text-lg mr-2">{f.rating}★</span>
                    <span className="text-gray-800">{f.comment}</span>
                  </div>
                  <div className="text-xs text-gray-500">{f.date}</div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {/* Loyalty Points Tab */}
        {activeTab === "Loyalty Points" && (
          <section className={sectionCard + " w-[600px] h-[420px] mx-auto"}>
            <h3 className="font-bold text-xl mb-5 text-gray-900 tracking-tight">Loyalty Points</h3>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-3xl font-bold text-blue-700">{loyalty.points} pts</div>
              <span className="text-xs text-gray-400">Total Points</span>
            </div>
            {/* Add Loyalty Points Form */}
            <form
              className="mb-4 flex gap-2 items-end"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target;
                const points = parseInt(form.points.value);
                const reason = form.reason.value.trim();
                if (!points || !reason) return;
                try {
                  await updateCustomerLoyalty(customer_id, points, reason);
                  // Refresh loyalty points after adding
                  const data = await getCustomerLoyalty(customer_id);
                  setLoyalty({
                    points: data.total_points || 0,
                    history: (data.history || []).map(item => ({
                      date: formatDate(item.date),
                      change: item.change > 0 ? `+${item.change}` : `${item.change}`,
                      reason: item.reason || "Transaction"
                    }))
                  });
                  form.points.value = "";
                  form.reason.value = "";
                } catch (error) {
                  alert("Failed to add loyalty points");
                }
              }}
            >
              <input
                name="points"
                type="number"
                className="border rounded px-3 py-2 w-28"
                placeholder="Points"
                min="1"
                required
              />
              <input
                name="reason"
                className="border rounded px-3 py-2 flex-1"
                placeholder="Reason"
                required
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded font-medium"
              >
                Add Points
              </button>
            </form>
            <ul className="divide-y max-h-[180px] overflow-y-auto">
              {loyalty.history.length === 0 && (
                <li className="text-gray-400 py-4">No loyalty history.</li>
              )}
              {loyalty.history.map((item, i) => (
                <li key={i} className="py-4 flex flex-col sm:flex-row gap-3">
                  <span className="text-blue-800 font-semibold">{item.change}</span>
                  <span className="text-gray-700">{item.reason}</span>
                  <span className="text-xs text-gray-400 ml-auto">{item.date}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {/* Notes Tab */}
        {activeTab === "Notes" && (
          <section className={sectionCard + " w-[600px] h-[380px] mx-auto"}>
            <h3 className="font-bold text-xl mb-5 text-gray-900 tracking-tight">Notes</h3>

            {/* Note form */}
            <form
              className="mb-4 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target;
                const content = form.note.value.trim();
                if (!content) return;

                try {
                  const newNote = await addCustomerNote(customer_id, content);
                  setNotes(prev => [
                    {
                      id: newNote.id,
                      content: newNote.content,
                      author: newNote.author || "User",
                      created_at: formatDate(newNote.created_at || new Date())
                    },
                    ...prev
                  ]);
                  form.note.value = "";
                } catch (error) {
                  console.error("Error adding note:", error);
                  alert("Failed to add note");
                }
              }}
            >
              <input
                name="note"
                className="flex-1 border rounded px-3 py-2"
                placeholder="Add a note..."
                required
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded font-medium"
              >
                Add Note
              </button>
            </form>

            <ul className="space-y-3 max-h-[250px] overflow-y-auto">
              {notes.length === 0 && (
                <li className="text-gray-400 py-4">No notes yet.</li>
              )}
              {notes.map(note => (
                <li key={note.id} className="bg-gray-100 rounded p-4 flex flex-col gap-1">
                  <div className="text-gray-800">{note.content}</div>
                  <div className="text-xs text-gray-500">
                    {note.author ? <span>{note.author}, </span> : ""}
                    {note.created_at}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {/* Activity Logs Tab */}
        {/* Activity Logs Tab removed */}
      </main>
    </div>
  );
}