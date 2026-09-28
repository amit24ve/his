import React, { useEffect, useState } from 'react';

function mapStatus(status, paidAmount, amount, dueDate) {
  if (status === 'completed' || status === 'paid' || paidAmount >= amount) return 'paid';
  if (dueDate && paidAmount < amount) {
    const today = new Date().toISOString().split('T')[0];
    if (dueDate < today) return 'overdue';
  }
  return 'pending';
}

const Notification = ({ show, message, type = 'info', onClose }) => {
  if (!show) return null;
  return (
    <div className={`fixed top-6 right-6 z-50 transition-all duration-700 animate-fadeInOut`}>
      <div className={`
        px-6 py-3 rounded-lg shadow-lg flex items-center gap-3
        ${type === 'success' ? 'bg-green-100 text-green-800 border border-green-300'
          : type === 'error' ? 'bg-red-100 text-red-800 border border-red-300'
            : 'bg-blue-100 text-blue-800 border border-blue-300'}
      `}>
        <span>
          {type === 'success' && <i className="fas fa-check-circle mr-2"></i>}
          {type === 'error' && <i className="fas fa-exclamation-circle mr-2"></i>}
          {type === 'info' && <i className="fas fa-bell mr-2"></i>}
          {message}
        </span>
        <button className="ml-4 text-xl leading-none font-bold text-gray-400 hover:text-gray-700" onClick={onClose}>&times;</button>
      </div>
    </div>
  );
};

const NotificationCard = ({ notification, onClose }) => (
  <div className="bg-blue-50 border-l-4 border-blue-400 shadow rounded-lg px-4 py-3 mb-2 flex items-center justify-between animate-fadeIn">
    <div className="flex items-center gap-3">
      <i className="fas fa-bell text-blue-500 text-xl"></i>
      <div>
        <div className="text-blue-800 font-semibold">{notification.title}</div>
        <div className="text-xs text-gray-600">{notification.body}</div>
        <div className="text-xs text-gray-400">{notification.timestamp ? new Date(notification.timestamp).toLocaleString() : ''}</div>
      </div>
    </div>
    <button className="text-gray-400 hover:text-red-500 text-xl font-bold ml-2" onClick={onClose}>&times;</button>
  </div>
);

const Modal = ({ open, onClose, children, cardStyle = false }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm transition-all duration-500">
      <div className={`relative w-full max-w-2xl mx-3 ${cardStyle ? "perspective" : ""}`}>
        <div className={`bg-white rounded-xl shadow-2xl transition-transform duration-700 ${cardStyle ? "transform-style-3d animate-flipInY" : ""}`}>
          <button
            onClick={onClose}
            className="absolute top-2 right-3 text-gray-400 hover:text-red-500 text-2xl font-bold z-10"
            aria-label="Close"
          >×</button>
          {children}
        </div>
      </div>
    </div>
  );
};

const PdfDownloadButton = ({ leadId }) => {
  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch(`https://cubehis.avopay.pro:5000/api/quotations/${leadId}/invoice`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("PDF could not be generated");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice_${leadId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to download PDF.");
    }
  };
  return (
    <button onClick={handleDownload} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded shadow font-semibold transition-all duration-200 flex items-center gap-2">
      <i className="fas fa-file-pdf"></i> Download PDF
    </button>
  );
};

const PaymentsPage = () => {
  const [payments, setPayments] = useState([]);
  const [leads, setLeads] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [summary, setSummary] = useState({
    total_amount: 0,
    acceptance_amount: 0,
    acceptance_rate: 0,
  });
  const [loading, setLoading] = useState(true);

  const [duePayModalOpen, setDuePayModalOpen] = useState(false);
  const [duePayInvoice, setDuePayInvoice] = useState(null);
  const [duePayAmount, setDuePayAmount] = useState("");

  // Modal/notification/card states
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: "", type: "info" });
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);

  // Notifications & Activity Log (state)
  const [notifications, setNotifications] = useState([]);
  const [activityLog, setActivityLog] = useState([]);

  // New invoice form
  const [newInvoice, setNewInvoice] = useState({
    quotation_id: "",
    client_name: "",
    amount: "",
    milestones: [{ title: "", amount: "", paid: false }]
  });

  // Filter state
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');


  useEffect(() => {
    document.title = 'B2B CRM - Payment Tracking';
    fetchData();
    fetchNotifications();
    fetchActivityLog();
    fetchLeads();
    fetchAllQuotations();
  }, []);



  const fetchLeads = async () => {
    try {
      const res = await fetch('https://cubehis.avopay.pro:5000/api/lead/leads?limit=1000', {
        headers: { "Authorization": `Bearer ${localStorage.getItem('access_token') || ''}` },
      });
      const data = await res.json();
      setLeads(data.data || []);
    } catch {
      setLeads([]);
    }

  };

  const fetchAllQuotations = async () => {
    try {
      const res = await fetch('https://cubehis.avopay.pro:5000/api/quotations/', {
        headers: { "Authorization": `Bearer ${localStorage.getItem('access_token') || ''}` }
      });
      const data = await res.json();
      setQuotations(data.quotations || []);
    } catch {
      setQuotations([]);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch('https://cubehis.avopay.pro:5000/api/quotations/', {
        headers: {
          "Authorization": `Bearer ${token}`
        },
      });
      const data = await res.json();
      const quotes = data.quotations || [];
      setSummary(data.summary || { total_amount: 0, acceptance_amount: 0, acceptance_rate: 0 });
      const mapped = quotes.map(q => {
        const invoiceDate = q.invoiceDate ||
          (q.created_at && typeof q.created_at === 'string'
            ? q.created_at.split('T')[0]
            : q.created_at && q.created_at.$date
              ? q.created_at.$date.split('T')[0]
              : '');
        const dueDate = q.dueDate ||
          (q.expiry_date && typeof q.expiry_date === 'string'
            ? q.expiry_date.split('T')[0]
            : q.expiry_date && q.expiry_date.$date
              ? q.expiry_date.$date.split('T')[0]
              : '');

        return {
          id: q.quotation_number || q.id || q._id,
          client: q.client || q.client_name || '',
          clientId: q.lead_id || '',
          amount: q.amount || 0,
          paidAmount: q.paid_amount || 0,
          remainingAmount: q.remaining_amount || 0,
          status: mapStatus(q.status, q.paid_amount || 0, q.amount || 0, dueDate),
          invoiceDate,
          dueDate,
          paymentDate: (q.paid_amount || 0) >= (q.amount || 0) ? dueDate : null,
          milestones: q.milestones || [],
          lead_id: q.lead_id,
          quotation_id: q.quotation_number || q.id || q._id,
        };
      });
      setPayments(mapped);
    } catch (e) {
      setPayments([]);
    }
    setLoading(false);
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?user_id=' + (localStorage.getItem('user_id') || ''));
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : (data.notifications || []));
    } catch { }
  };

  const fetchActivityLog = async () => {
    try {
      const res = await fetch('/api/activity-log?user_id=' + (localStorage.getItem('user_id') || ''));
      if (!res.ok) return;
      const data = await res.json();
      setActivityLog(Array.isArray(data) ? data : (data.logs || []));
    } catch { }
  };

  // Filter logic
  const filteredPayments = payments.filter(payment => {
    let match = true;
    if (statusFilter && payment.status !== statusFilter) match = false;
    if (dateFrom && payment.invoiceDate < dateFrom) match = false;
    if (dateTo && payment.invoiceDate > dateTo) match = false;
    return match;
  });

  // Statistics
  const totalPaid = filteredPayments.reduce((sum, payment) => sum + (payment.paidAmount || 0), 0);
  const totalPending = filteredPayments
    .filter(payment => payment.status === 'pending' || payment.status === 'overdue')
    .reduce((sum, p) => sum + (p.remainingAmount || 0), 0);
  const totalOverdue = filteredPayments.filter(p => p.status === 'overdue').reduce((sum, p) => sum + (p.remainingAmount || 0), 0);

  // Send Reminder
  const handleSendReminder = async (paymentId) => {
    try {
      const payment = payments.find(p => p.id === paymentId);
      if (!payment) throw new Error('Payment not found');
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch(`/api/reminders/send/${paymentId}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to send reminder");
      setNotifications(curr => [
        {
          title: "Payment Reminder Sent",
          body: `Reminder sent for invoice ${paymentId} (${payment.client})`,
          timestamp: new Date().toISOString()
        },
        ...curr
      ]);
      setActivityLog(curr => [
        {
          type: "reminder_sent",
          msg: `Reminder sent for lead ${payment.clientId} (invoice ${paymentId}) at ${new Date().toLocaleString()}`,
          timestamp: new Date().toISOString()
        },
        ...curr
      ]);
      setNotification({
        show: true,
        message: `Payment reminder sent for invoice ${paymentId}`,
        type: "success",
      });
      setTimeout(() => setNotification({ show: false, message: "", type: "info" }), 2000);
      fetchNotifications();
      fetchActivityLog();
    } catch {
      setNotification({
        show: true,
        message: "Failed to send reminder",
        type: "error",
      });
      setTimeout(() => setNotification({ show: false, message: "", type: "info" }), 2000);
    }
  };

  // Open Due Payment Modal
  const handleOpenDuePay = (invoice) => {
    setDuePayInvoice(invoice);
    setDuePayAmount(invoice.remainingAmount || "");
    setDuePayModalOpen(true);
  };

  // Close Due Payment Modal
  const handleCloseDuePay = () => {
    setDuePayModalOpen(false);
    setDuePayInvoice(null);
    setDuePayAmount("");
  };

  // Handle PATCH to backend for Due Payment
  const handleDuePaySubmit = async (e) => {
    e.preventDefault();
    if (!duePayInvoice || !duePayAmount || isNaN(duePayAmount) || duePayAmount <= 0) {
      setNotification({ show: true, message: "Enter a valid payment amount.", type: "error" });
      setTimeout(() => setNotification({ show: false, message: "", type: "info" }), 2000);
      return;
    }
    try {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch(`https://cubehis.avopay.pro:5000/api/quotations/${duePayInvoice.lead_id}/duepay`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ amount: parseFloat(duePayAmount) })
      });
      if (!res.ok) throw new Error("Failed to record payment");
      setNotification({ show: true, message: "Payment updated!", type: "success" });
      setTimeout(() => setNotification({ show: false, message: "", type: "info" }), 2000);
      handleCloseDuePay();
      fetchData();
    } catch (e) {
      setNotification({ show: true, message: "Error updating payment", type: "error" });
      setTimeout(() => setNotification({ show: false, message: "", type: "info" }), 2000);
    }
  };

  const handleMarkPaid = (paymentId) => {
    setPayments(payments.map(payment => {
      if (payment.id === paymentId) {
        return {
          ...payment,
          status: 'paid',
          paidAmount: payment.amount,
          remainingAmount: 0,
          paymentDate: new Date().toISOString().split('T')[0]
        };
      }
      return payment;
    }));
    setNotification({
      show: true,
      message: `Payment marked as received for invoice ${paymentId}`,
      type: "success",
    });
    setTimeout(() => setNotification({ show: false, message: "", type: "info" }), 2000);
  };

  const handleResetFilters = () => {
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setModalOpen(true);
  };

  // New Invoice logic
  const handleOpenNewInvoice = () => setNewInvoiceOpen(true);
  const handleCloseNewInvoice = () => {
    setNewInvoice({
      quotation_id: "",
      client_name: "",
      amount: "",
      milestones: [{ title: "", amount: "", paid: false }]
    });
    setNewInvoiceOpen(false);
  };

  const handleNewInvoiceQuotationChange = (e) => {
    const val = e.target.value;
    setNewInvoice((prev) => ({ ...prev, quotation_id: val }));
    if (val) {
      const quote = quotations.find(q =>
        (q.quotation_number && q.quotation_number === val) ||
        (q.id && q.id === val) ||
        (q._id && q._id === val)
      );
      if (quote) {
        setNewInvoice((prev) => ({
          ...prev,
          quotation_id: val,
          lead_id: quote.lead_id || "",
          client_name: quote.client_name || quote.client || "",
          amount: quote.amount || "",
          milestones: quote.milestones && quote.milestones.length > 0
            ? quote.milestones.map(m => ({
              title: m.title || "",
              amount: m.amount || "",
              paid: m.paid || false
            }))
            : [{ title: "", amount: "", paid: false }]
        }));
      }
    }
  };


  const handleNewInvoiceChange = (e) => {
    setNewInvoice({ ...newInvoice, [e.target.name]: e.target.value });
  };

  const handleMilestoneChange = (index, field, value) => {
    const updated = [...newInvoice.milestones];
    updated[index][field] = field === "amount" ? parseFloat(value) : value;
    setNewInvoice({ ...newInvoice, milestones: updated });
  };

  const addMilestone = () => {
    setNewInvoice({
      ...newInvoice,
      milestones: [...newInvoice.milestones, { title: "", amount: "", paid: false }]
    });
  };

  const removeMilestone = (index) => {
    setNewInvoice({
      ...newInvoice,
      milestones: newInvoice.milestones.filter((_, i) => i !== index)
    });
  };

  const handleNewInvoiceSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = {
        quotation_id: newInvoice.quotation_id,
        lead_id: newInvoice.lead_id,
        client_name: newInvoice.client_name,
        amount: parseFloat(newInvoice.amount),
        milestones: newInvoice.milestones.map(m => ({
          title: m.title,
          amount: parseFloat(m.amount),
          paid: Boolean(m.paid)
        }))
      };
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch('https://cubehis.avopay.pro:5000/api/quotations/', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("Failed to create invoice");
      setNotification({ show: true, message: "Invoice created! Downloading PDF...", type: "success" });
      setTimeout(() => setNotification({ show: false, message: "", type: "info" }), 2000);
      handleCloseNewInvoice();
      fetchData();
      const data = await res.json();
      setTimeout(() => {
        window.open(`https://cubehis.avopay.pro:5000/api/quotations/${data.lead_id}/invoice`, "_blank");
      }, 1200);
    } catch (e) {
      setNotification({ show: true, message: "Error creating invoice", type: "error" });
      setTimeout(() => setNotification({ show: false, message: "", type: "info" }), 2000);
    }
  };

  // Modal for invoice details as 3d card
  const renderInvoiceModal = () => {
    if (!selectedInvoice) return null;
    return (
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} cardStyle>
        <div className="p-8">
          <h2 className="text-2xl font-bold text-blue-700 mb-5 flex items-center gap-2">
            <i className="fas fa-file-invoice"></i>
            Invoice Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mb-5">
            <div><b>Invoice ID:</b> {selectedInvoice.id}</div>
            <div><b>Client:</b> {selectedInvoice.client}</div>
            <div><b>Client ID:</b> {selectedInvoice.clientId}</div>
            <div><b>Invoice Date:</b> {selectedInvoice.invoiceDate}</div>
            <div><b>Due Date:</b> {selectedInvoice.dueDate}</div>
            <div><b>Status:</b> <span className={`font-semibold ${selectedInvoice.status === 'paid' ? 'text-green-700' : selectedInvoice.status === 'overdue' ? 'text-red-700' : 'text-yellow-700'}`}>{selectedInvoice.status.toUpperCase()}</span></div>
          </div>
          <div className="mb-2">
            <b>Amount:</b> ₹{selectedInvoice.amount.toLocaleString()}
          </div>
          <div className="mb-2">
            <b>Paid Amount:</b> ₹{selectedInvoice.paidAmount.toLocaleString()}
          </div>
          <div className="mb-2">
            <b>Remaining Amount:</b> ₹{selectedInvoice.remainingAmount.toLocaleString()}
          </div>
          <div className="mb-4">
            <b>Milestones:</b>
            <ul className="ml-3 mt-1">
              {(selectedInvoice.milestones || []).map((m, i) => (
                <li key={i} className="mb-1">
                  <span className="inline-block rounded px-2 py-1 bg-gray-100 mr-2">{m.title || `Milestone ${i + 1}`}</span>
                  Amount: ₹{m.amount} |
                  Paid: {m.paid ? <span className="text-green-700 font-semibold ml-1">Yes</span> : <span className="text-red-700 font-semibold ml-1">No</span>} |
                  Paid Amount: ₹{m.paid_amount || 0}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-4 justify-end">
            <PdfDownloadButton leadId={selectedInvoice.lead_id} />
            <button className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 transition" onClick={() => setModalOpen(false)}>
              Close
            </button>
          </div>
        </div>
      </Modal>
    );
  };

  // Modal for create new invoice as 3d card
  const renderNewInvoiceModal = () => (
    <Modal open={newInvoiceOpen} onClose={handleCloseNewInvoice} cardStyle>
      <form className="p-8" onSubmit={handleNewInvoiceSubmit}>
        <h2 className="text-2xl font-bold text-purple-700 mb-5 flex items-center gap-2">
          <i className="fas fa-plus-circle"></i>
          Create New Invoice
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 mb-4">
          <div>
            <label className="block mb-1 font-medium">Quotation ID</label>
            <select
              name="quotation_id"
              required
              value={newInvoice.quotation_id}
              onChange={handleNewInvoiceQuotationChange}
              className="border px-3 py-2 rounded w-full focus:ring focus:ring-purple-100"
            >
              <option value="">Select Quotation</option>
              {quotations.map(q => (
                <option key={q.quotation_number || q.id || q._id} value={q.quotation_number || q.id || q._id}>
                  {(q.quotation_number || q.id || q._id) + " - " + (q.client_name || q.client || "-")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 font-medium">Lead ID</label>
            <input
              type="text"
              name="lead_id"
              required
              value={newInvoice.lead_id}
              onChange={handleNewInvoiceChange}
              className="border px-3 py-2 rounded w-full focus:ring focus:ring-purple-100"
              readOnly
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Client Name</label>
            <input
              type="text"
              name="client_name"
              required
              value={newInvoice.client_name}
              onChange={handleNewInvoiceChange}
              className="border px-3 py-2 rounded w-full focus:ring focus:ring-purple-100"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Total Amount</label>
            <input
              type="number"
              name="amount"
              min={0}
              required
              value={newInvoice.amount}
              onChange={handleNewInvoiceChange}
              className="border px-3 py-2 rounded w-full focus:ring focus:ring-purple-100"
            />
          </div>
        </div>
        <div className="mb-3">
          <label className="block font-medium mb-2">Milestones</label>
          {(newInvoice.milestones || []).map((m, i) => (
            <div key={i} className="flex gap-2 mb-2 items-center">
              <input
                type="text"
                placeholder={`Milestone ${i + 1}`}
                value={m.title}
                onChange={e => handleMilestoneChange(i, "title", e.target.value)}
                className="border px-2 py-1 rounded flex-1"
              />
              <input
                type="number"
                min={0}
                placeholder="Amount"
                value={m.amount}
                onChange={e => handleMilestoneChange(i, "amount", e.target.value)}
                className="border px-2 py-1 rounded w-28"
              />
              {newInvoice.milestones.length > 1 && (
                <button type="button" className="text-red-600 text-xl" onClick={() => removeMilestone(i)}>
                  ×
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addMilestone} className="mt-2 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-sm font-medium">
            <i className="fas fa-plus"></i> Add Milestone
          </button>
        </div>
        <div className="flex gap-4 justify-end mt-6">
          <button type="button" className="bg-gray-100 text-gray-700 px-4 py-2 rounded font-semibold hover:bg-gray-200" onClick={handleCloseNewInvoice}>
            Cancel
          </button>
          <button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded font-semibold hover:bg-purple-700 transition flex items-center gap-2">
            <i className="fas fa-download"></i> Create & Download PDF
          </button>
        </div>
      </form>
    </Modal>
  );

  // Modal for Due Payment
  const renderDuePayModal = () => {
    if (!duePayInvoice) return null;
    return (
      <Modal open={duePayModalOpen} onClose={handleCloseDuePay} cardStyle>
        <form className="p-8" onSubmit={handleDuePaySubmit}>
          <h2 className="text-2xl font-bold text-green-700 mb-5 flex items-center gap-2">
            <i className="fas fa-rupee-sign"></i>
            Pay Due Amount
          </h2>
          <div className="mb-4">
            <b>Client:</b> {duePayInvoice.client} <br />
            <b>Invoice ID:</b> {duePayInvoice.id} <br />
            <b>Remaining Amount:</b>{" "}
            <span className="font-mono text-2xl text-red-600">
              ₹{Number(duePayInvoice.remainingAmount).toLocaleString()}
            </span>
          </div>
          <div className="mb-5">
            <label className="block mb-1 font-medium">Pay Amount</label>
            <input
              type="number"
              min={1}
              max={duePayInvoice.remainingAmount}
              required
              value={duePayAmount}
              onChange={e => setDuePayAmount(e.target.value)}
              className="border px-3 py-2 rounded w-full focus:ring focus:ring-green-100"
            />
          </div>
          <div className="flex gap-4 justify-end mt-6">
            <button type="button" className="bg-gray-100 text-gray-700 px-4 py-2 rounded font-semibold hover:bg-gray-200" onClick={handleCloseDuePay}>
              Cancel
            </button>
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded font-semibold hover:bg-green-700 transition flex items-center gap-2">
              <i className="fas fa-rupee-sign"></i> Pay
            </button>
          </div>
        </form>
      </Modal>
    );
  };

  if (loading) {
    return <div className="p-8 text-center text-lg text-blue-600">Loading payments...</div>;
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <Notification
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ show: false, message: "", type: "info" })}
      />
      {renderInvoiceModal()}
      {renderNewInvoiceModal()}
      {renderDuePayModal()}

      {/* Notifications Section (Cards) */}
      <div className="fixed bottom-6 right-6 z-40 w-96">
        {notifications.slice(0, 5).map((n, idx) => (
          <NotificationCard
            key={idx}
            notification={n}
            onClose={() => setNotifications(notifications.filter((_, i) => i !== idx))}
          />
        ))}
      </div>

      {/* Activity Log Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 mt-2">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Activity Log</h2>
        <ul>
          {activityLog.slice(0, 10).map((log, idx) => (
            <li key={idx} className="mb-1 text-sm text-gray-700">
              <i className="fas fa-history mr-2 text-blue-500"></i>
              {log.msg || log.details || ""}
              <span className="text-gray-400 text-xs ml-2">{log.timestamp ? new Date(log.timestamp).toLocaleString() : ""}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Page Header with Meta Information */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 border-b border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Payment Tracking</h1>
            <p className="text-sm text-gray-500 mt-1">Track invoices and manage payments</p>
          </div>
          <div className="mt-4 md:mt-0 flex flex-col md:flex-row md:items-center gap-3">
            <button
              className="bg-blue-600 text-white py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
              onClick={handleOpenNewInvoice}
              style={{ transform: "perspective(400px) rotateY(-8deg)", boxShadow: "0 10px 30px rgba(0,0,0,0.07)" }}
            >
              <i className="fas fa-plus"></i> New Invoice
            </button>
          </div>
        </div>
        <div className="p-4 bg-gray-50 text-sm flex flex-wrap justify-between">
          <div className="text-gray-600">
            <i className="far fa-clock mr-2"></i>{new Date().toISOString().split('.')[0].replace('T', ' ')} (UTC)
          </div>
          <div className="text-gray-600">
            <i className="far fa-user mr-2"></i>Logged in as: {localStorage.getItem('username') || '—'}
          </div>
        </div>
      </div>

      {/* Payment Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border-l-4 border-green-500 transform transition-transform duration-300 hover:scale-105 hover:rotate-y-3d">
          <h3 className="text-gray-500 text-sm mb-1">Total Paid Amount</h3>
          <p className="text-2xl font-bold text-green-600">₹{totalPaid.toLocaleString()}</p>
          <div className="flex justify-between items-center mt-2">
            <p className="text-sm text-gray-500">
              {filteredPayments.filter(p => p.status === 'paid').length} paid invoices
            </p>
            <span className="text-green-500 text-lg">
              <i className="fas fa-check-circle"></i>
            </span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border-l-4 border-yellow-500 transform transition-transform duration-300 hover:scale-105 hover:rotate-y-3d">
          <h3 className="text-gray-500 text-sm mb-1">Total Pending Amount</h3>
          <p className="text-2xl font-bold text-yellow-600">₹{totalPending.toLocaleString()}</p>
          <div className="flex justify-between items-center mt-2">
            <p className="text-sm text-gray-500">
              {filteredPayments.filter(p => p.status === 'pending' || p.status === 'overdue').length} pending invoices
            </p>
            <span className="text-yellow-500 text-lg">
              <i className="fas fa-clock"></i>
            </span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border-l-4 border-red-500 transform transition-transform duration-300 hover:scale-105 hover:rotate-y-3d">
          <h3 className="text-gray-500 text-sm mb-1">Total Overdue Amount</h3>
          <p className="text-2xl font-bold text-red-600">₹{totalOverdue.toLocaleString()}</p>
          <div className="flex justify-between items-center mt-2">
            <p className="text-sm text-gray-500">
              {filteredPayments.filter(p => p.status === 'overdue').length} overdue invoices
            </p>
            <span className="text-red-500 text-lg">
              <i className="fas fa-exclamation-circle"></i>
            </span>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Filter Invoices</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              id="status-filter"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div>
            <label htmlFor="date-from" className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              id="date-from"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="date-to" className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              id="date-to"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={handleResetFilters} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors mr-2">
            Reset Filters
          </button>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Invoice Database</h2>
          <div className="text-sm text-gray-500">
            Total: {filteredPayments.length} invoices
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase tracking-wider">
                <th className="px-4 py-2 text-left font-semibold">Invoice ID</th>
                <th className="px-4 py-2 text-left font-semibold">Client</th>
                <th className="px-4 py-2 text-left font-semibold">Amount</th>
                <th className="px-4 py-2 text-left font-semibold">Paid</th>
                <th className="px-4 py-2 text-left font-semibold">Remaining</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2 text-left font-semibold hidden lg:table-cell">Invoice Date</th>
                <th className="px-4 py-2 text-left font-semibold hidden md:table-cell">Due Date</th>
                <th className="px-4 py-2 text-left font-semibold hidden lg:table-cell">Payment Date</th>
                <th className="px-4 py-2 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment, index) => (
                <tr
                  key={payment.id}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    } border-b border-gray-100 hover:bg-blue-50 transition-colors`}
                >
                  <td className="px-4 py-3 text-sm text-gray-800 font-medium whitespace-nowrap">{payment.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-800">
                    {payment.client}
                    <div className="text-xs text-gray-500">{payment.clientId}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800 font-semibold whitespace-nowrap">
                    ₹{(payment.amount || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-green-800 font-semibold whitespace-nowrap">
                    ₹{(payment.paidAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-yellow-800 font-semibold whitespace-nowrap">
                    ₹{(payment.remainingAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex items-center rounded-full text-xs font-medium ${payment.status === 'paid'
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : payment.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                            : 'bg-red-100 text-red-700 border border-red-200'
                        }`}
                    >
                      {payment.status === 'paid' && <i className="fas fa-check-circle mr-1.5"></i>}
                      {payment.status === 'pending' && <i className="fas fa-clock mr-1.5"></i>}
                      {payment.status === 'overdue' && <i className="fas fa-exclamation-circle mr-1.5"></i>}
                      {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                    </span>
                    <div className="text-xs text-gray-500 mt-1 md:hidden">Due: {payment.dueDate}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 hidden lg:table-cell">{payment.invoiceDate}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 hidden md:table-cell">{payment.dueDate}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 hidden lg:table-cell">{payment.paymentDate || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-1">
                      <button
                        className="text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 p-2 rounded shadow transition-all duration-200 transform hover:scale-110"
                        title="View Invoice"
                        onClick={() => handleViewInvoice(payment)}
                      >
                        <i className="fas fa-eye text-lg"></i>
                      </button>
                      {payment.remainingAmount > 0 && (
                        <button
                          onClick={() => handleOpenDuePay(payment)}
                          className="text-green-600 hover:text-green-800 bg-green-50 border border-green-200 p-2 rounded shadow transition-all duration-200 transform hover:scale-110"
                          title="Pay Due"
                        >
                          <i className="fas fa-rupee-sign text-lg"></i>
                        </button>
                      )}
                      {/* {payment.status !== 'paid' && (
                        <button
                          onClick={() => handleSendReminder(payment.id)}
                          className="text-yellow-600 hover:text-yellow-800 bg-yellow-50 border border-yellow-200 p-2 rounded shadow transition-all duration-200 transform hover:scale-110"
                          title="Send Reminder"
                        >
                          <i className="fas fa-bell text-lg"></i>
                        </button>
                      )} */}
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
};

export default PaymentsPage;



// import React, { useEffect, useState } from 'react';
// import { getCurrentUserLogin } from '../utils';



// function getTimeZoneAbbr(date = new Date()) {
//   // Use en-IN to get Indian abbreviations like "IST" instead of "GMT+5:30"
//   const match = date
//     .toLocaleTimeString('en-IN', { timeZoneName: 'short' })
//     .match(/\b([A-Z]{2,5}|UTC)\b$/);
//   return match ? match[1] : '';
// }

// function PaymentTrackingHeader({ userLogin }) {
//   // Real-time clock state
//   const [now, setNow] = useState(new Date());
//   useEffect(() => {
//     const timer = setInterval(() => setNow(new Date()), 1000);
//     return () => clearInterval(timer);
//   }, []);

//   // Local date and time
//   const localDate = now.toLocaleDateString();
//   const localTime = now.toLocaleTimeString([], { hour12: false });
//   const tzAbbr = getTimeZoneAbbr(now);

//   return (
//     <section
//       className="
//         w-full
//         bg-white
//         rounded-2xl
//         shadow-2xl
//         shadow-blue-200/60
//         mb-8
//         overflow-hidden
//         border
//         border-gray-100
//         transition-all
//         duration-300
//         hover:shadow-2xl
//         hover:shadow-blue-300/80
//       "
//       style={{
//         background: "linear-gradient(90deg, #f8fafc 0%, #ffffff 100%)",
//       }}
//     >
//       <div className="
//         flex flex-col gap-4
//         sm:flex-row sm:justify-between sm:items-center
//         p-8 pb-6 border-b border-gray-100
//       ">
//         <div>
//           <div className="flex items-center gap-3 mb-2">
//             <span className="inline-flex items-center justify-center rounded-xl bg-blue-100 shadow-sm shadow-blue-200 h-10 w-10 text-blue-600 text-2xl">
//               <i className="fas fa-credit-card"></i>
//             </span>
//             <h1 className="text-3xl font-extrabold text-gray-800 leading-tight tracking-tight" style={{letterSpacing: "-.01em"}}>
//               Payment Tracking
//             </h1>
//           </div>
//           <p className="text-base text-gray-500 mt-0.5 font-medium">
//             Track invoices and manage payments
//           </p>
//         </div>
//         <div className="
//           flex items-center gap-3 px-5 py-2 rounded-xl shadow-md
//           bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-100
//           text-blue-800 font-semibold tracking-wide
//           min-w-max
//           w-full sm:w-auto justify-center
//         ">
//           <span className="inline-flex items-center justify-center mr-2 rounded-full bg-white border border-blue-200 shadow-sm h-7 w-7 text-blue-500 text-lg">
//             <i className="far fa-clock"></i>
//           </span>
//           <span className="whitespace-nowrap">
//             {localDate} {localTime}
//             {tzAbbr && <span className="text-xs text-blue-500 ml-1">({tzAbbr})</span>}
//           </span>
//         </div>
//       </div>
//     </section>
//   );
// }

// // --- PDF Download Button with local loading state ---
// function PdfDownloadButton({ leadId }) {
//   const [loading, setLoading] = useState(false);

//   const handleDownload = async () => {
//     setLoading(true);
//     try {
//       const res = await fetch(`https://cubehis.avopay.pro:5000/api/quotations/${leadId}/invoice`, {
//         method: "POST",
//         headers: {
//           Authorization: Bearer `${localStorage.getItem('access_token') || ''}`,
//         }
//       });
//       if (!res.ok) throw new Error("PDF could not be generated");
//       const blob = await res.blob();
//       const url = window.URL.createObjectURL(blob);
//       const link = document.createElement('a');
//       link.href = url;
//       link.download = `invoice_${leadId}`.pdf;
//       document.body.appendChild(link);
//       link.click();
//       link.remove();
//       window.URL.revokeObjectURL(url);
//     } catch (e) {
//       alert("Failed to download PDF.");
//     }
//     setLoading(false);
//   };

//   return (
//     <button
//       onClick={handleDownload}
//       disabled={loading}
//       className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded shadow font-semibold transition-all duration-200 flex items-center gap-2"
//     >
//       {loading ? (
//         <>
//           <i className="fas fa-spinner fa-spin"></i> Downloading...
//         </>
//       ) : (
//         <>
//           <i className="fas fa-file-pdf"></i> Download PDF
//         </>
//       )}
//     </button>
//   );
// }

// function mapStatus(status, paidAmount, amount, dueDate) {
//   if (status === 'completed' || status === 'paid' || paidAmount >= amount) return 'paid';
//   if (dueDate && paidAmount < amount) {
//     const today = new Date().toISOString().split('T')[0];
//     if (dueDate < today) return 'overdue';
//   }
//   return 'pending';
// }

// // --- TableRowCard: Responsive card for mobile screens ---
// function TableRowCard({ payment, onView }) {
//   return (
//     <div className="bg-white rounded-xl shadow p-4 mb-4 flex flex-col gap-2 border border-gray-100">
//       <div className="flex justify-between items-center">
//         <span className="text-lg font-bold text-gray-800">Invoice #{payment.id}</span>
//         <span className={`px-2 py-1 text-xs rounded-full font-semibold ${
//           payment.status === 'paid'
//             ? 'bg-green-100 text-green-700'
//             : payment.status === 'pending'
//             ? 'bg-yellow-100 text-yellow-700'
//             : 'bg-red-100 text-red-700'
//         }`}>
//           {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
//         </span>
//       </div>
//       <div className="text-gray-600 text-sm">
//         <b>Client:</b> {payment.client} <span className="ml-2 text-gray-400">({payment.clientId})</span>
//       </div>
//       <div className="flex flex-wrap gap-4 mt-2">
//         <div className="text-sm"><b>Amount:</b> ₹{(payment.amount || 0).toLocaleString()}</div>
//         <div className="text-sm text-green-700"><b>Paid:</b> ₹{(payment.paidAmount || 0).toLocaleString()}</div>
//         <div className="text-sm text-yellow-700"><b>Remaining:</b> ₹{(payment.remainingAmount || 0).toLocaleString()}</div>
//       </div>
//       <div className="text-xs text-gray-500 mt-2">
//         <div><b>Invoice:</b> {payment.invoiceDate} <b>Due:</b> {payment.dueDate} <b>Payment:</b> {payment.paymentDate || '—'}</div>
//       </div>
//       <div className="flex justify-end mt-2">
//         <button
//           className="text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 p-2 rounded shadow transition-all duration-200 flex items-center gap-1"
//           title="View Invoice"
//           onClick={() => onView(payment)}
//         >
//           <i className="fas fa-eye text-lg"></i> <span className="text-sm font-medium">View</span>
//         </button>
//       </div>
//     </div>
//   );
// }

// const PaymentsPage = () => {
//   const [payments, setPayments] = useState([]);
//   const [leads, setLeads] = useState([]);
//   const [quotations, setQuotations] = useState([]);
//   const [summary, setSummary] = useState({
//     total_amount: 0,
//     acceptance_amount: 0,
//     acceptance_rate: 0,
//   });
//   const [loading, setLoading] = useState(true);

//   // Filter state
//   const [statusFilter, setStatusFilter] = useState('');
//   const [dateFrom, setDateFrom] = useState('');
//   const [dateTo, setDateTo] = useState('');

//   // Modal state for invoice view
//   const [modalOpen, setModalOpen] = useState(false);
//   const [selectedInvoice, setSelectedInvoice] = useState(null);

//   // User login from session/global/localStorage
//   const [userLogin, setUserLogin] = useState(getCurrentUserLogin());

//   useEffect(() => {
//     document.title = 'B2B CRM - Payment Tracking';
//     fetchData();
//     fetchLeads();
//     fetchAllQuotations();

//     function updateUserLogin() {
//       setUserLogin(getCurrentUserLogin());
//     }
//     updateUserLogin();

//     window.addEventListener('storage', updateUserLogin);
//     window.addEventListener('userchange', updateUserLogin);

//     return () => {
//       window.removeEventListener('storage', updateUserLogin);
//       window.removeEventListener('userchange', updateUserLogin);
//     };
//   }, []);

//   const fetchLeads = async () => {
//     try {
//       const res = await fetch('https://cubehis.avopay.pro:5000/api/lead/leads?limit=1000', {
//         headers: { Authorization: Bearer `${localStorage.getItem('access_token') || ''} `},
//       });
//       const data = await res.json();
//       setLeads(data.data || []);
//     } catch {
//       setLeads([]);
//     }
//   };

//   const fetchAllQuotations = async () => {
//     try {
//       const res = await fetch('https://cubehis.avopay.pro:5000/api/quotations/', {
//         headers: { Authorization: Bearer `${localStorage.getItem('access_token') || ''}` }
//       });
//       const data = await res.json();
//       setQuotations(data.quotations || []);
//     } catch {
//       setQuotations([]);
//     }
//   };

//   const fetchData = async () => {
//     setLoading(true);
//     try {
//       const res = await fetch('https://cubehis.avopay.pro:5000/api/quotations/', {
//         headers: {
//           Authorization: Bearer `${localStorage.getItem('access_token') || ''}`,
//         },
//       });
//       const data = await res.json();
//       const quotes = data.quotations || [];
//       setSummary(data.summary || { total_amount: 0, acceptance_amount: 0, acceptance_rate: 0 });
//       const mapped = quotes.map(q => {
//         const invoiceDate = q.invoiceDate ||
//           (q.created_at && typeof q.created_at === 'string'
//             ? q.created_at.split('T')[0]
//             : q.created_at && q.created_at.$date
//               ? q.created_at.$date.split('T')[0]
//               : '');
//         const dueDate = q.dueDate ||
//           (q.expiry_date && typeof q.expiry_date === 'string'
//             ? q.expiry_date.split('T')[0]
//             : q.expiry_date && q.expiry_date.$date
//               ? q.expiry_date.$date.split('T')[0]
//               : '');

//         return {
//           id: q.quotation_number || q.id || q._id,
//           client: q.client || q.client_name || '',
//           clientId: q.lead_id || '',
//           amount: q.amount || 0,
//           paidAmount: q.paid_amount || 0,
//           remainingAmount: q.remaining_amount || 0,
//           status: mapStatus(q.status, q.paid_amount || 0, q.amount || 0, dueDate),
//           invoiceDate,
//           dueDate,
//           paymentDate: (q.paid_amount || 0) >= (q.amount || 0) ? dueDate : null,
//           milestones: q.milestones || [],
//           lead_id: q.lead_id,
//           quotation_id: q.quotation_number || q.id || q._id,
//         };
//       });
//       setPayments(mapped);
//     } catch (e) {
//       setPayments([]);
//     }
//     setLoading(false);
//   };

//   // Filter logic
//   const filteredPayments = payments.filter(payment => {
//     let match = true;
//     if (statusFilter && payment.status !== statusFilter) match = false;
//     if (dateFrom && payment.invoiceDate < dateFrom) match = false;
//     if (dateTo && payment.invoiceDate > dateTo) match = false;
//     return match;
//   });

//   // Statistics
//   const totalPaid = filteredPayments.reduce((sum, payment) => sum + (payment.paidAmount || 0), 0);
//   const totalPending = filteredPayments
//     .filter(payment => payment.status === 'pending' || payment.status === 'overdue')
//     .reduce((sum, p) => sum + (p.remainingAmount || 0), 0);
//   const totalOverdue = filteredPayments.filter(p => p.status === 'overdue').reduce((sum, p) => sum + (p.remainingAmount || 0), 0);

//   // View Invoice Modal (responsive)
//   function InvoiceModal({ open, onClose, invoice }) {
//     if (!open || !invoice) return null;
//     return (
//       <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm">
//         <div className="relative w-full max-w-2xl mx-2 sm:mx-3">
//           <div
//             className="bg-white rounded-xl shadow-2xl p-4 sm:p-8 max-h-[90vh] overflow-y-auto"
//             style={{ minWidth: 0 }}
//           >
//             <button
//               onClick={onClose}
//               className="absolute top-2 right-3 text-gray-400 hover:text-red-500 text-2xl font-bold z-10"
//               aria-label="Close"
//             >×</button>
//             <h2 className="text-xl sm:text-2xl font-bold text-blue-700 mb-4 flex items-center gap-2">
//               <i className="fas fa-file-invoice"></i>
//               Invoice Details
//             </h2>
//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-5">
//               <div><b>Invoice ID:</b> {invoice.id}</div>
//               <div><b>Client:</b> {invoice.client}</div>
//               <div><b>Client ID:</b> {invoice.clientId}</div>
//               <div><b>Invoice Date:</b> {invoice.invoiceDate}</div>
//               <div><b>Due Date:</b> {invoice.dueDate}</div>
//               <div><b>Status:</b> <span className={font-semibold `${invoice.status === 'paid' ? 'text-green-700' : invoice.status === 'overdue' ? 'text-red-700' : 'text-yellow-700'}`}>{invoice.status.toUpperCase()}</span></div>
//             </div>
//             <div className="mb-2">
//               <b>Amount:</b> ₹{invoice.amount.toLocaleString()}
//             </div>
//             <div className="mb-2">
//               <b>Paid Amount:</b> ₹{invoice.paidAmount.toLocaleString()}
//             </div>
//             <div className="mb-2">
//               <b>Remaining Amount:</b> ₹{invoice.remainingAmount.toLocaleString()}
//             </div>
//             <div className="mb-4">
//               <b>Milestones:</b>
//               <ul className="ml-3 mt-1">
//                 {(invoice.milestones || []).map((m, i) => (
//                   <li key={i} className="mb-1 break-all">
//                     <span className="inline-block rounded px-2 py-1 bg-gray-100 mr-2">{m.title || Milestone `${i + 1}`}</span>
//                     Amount: ₹{m.amount} |
//                     Paid: {m.paid ? <span className="text-green-700 font-semibold ml-1">Yes</span> : <span className="text-red-700 font-semibold ml-1">No</span>} |
//                     Paid Amount: ₹{m.paid_amount || 0}
//                   </li>
//                 ))}
//               </ul>
//             </div>
//             <div className="flex flex-col sm:flex-row gap-3 justify-end">
//               <PdfDownloadButton leadId={invoice.lead_id} />
//               <button className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 transition" onClick={onClose}>
//                 Close
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   if (loading) {
//     return <div className="p-8 text-center text-lg text-blue-600">Loading payments...</div>;
//   }

//   return (
//     <div className="p-6 bg-gray-50 min-h-screen">
//       <PaymentTrackingHeader userLogin={userLogin} />

//       {/* View Invoice Modal */}
//       <InvoiceModal open={modalOpen} onClose={() => setModalOpen(false)} invoice={selectedInvoice} />

//       {/* Payment Statistics */}
//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
//         <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border-l-4 border-green-500 transform transition-transform duration-300 hover:scale-105">
//           <h3 className="text-gray-500 text-sm mb-1">Total Paid Amount</h3>
//           <p className="text-2xl font-bold text-green-600">₹{totalPaid.toLocaleString()}</p>
//           <div className="flex justify-between items-center mt-2">
//             <p className="text-sm text-gray-500">
//               {filteredPayments.filter(p => p.status === 'paid').length} paid invoices
//             </p>
//             <span className="text-green-500 text-lg">
//               <i className="fas fa-check-circle"></i>
//             </span>
//           </div>
//         </div>
//         <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border-l-4 border-yellow-500 transform transition-transform duration-300 hover:scale-105">
//           <h3 className="text-gray-500 text-sm mb-1">Total Pending Amount</h3>
//           <p className="text-2xl font-bold text-yellow-600">₹{totalPending.toLocaleString()}</p>
//           <div className="flex justify-between items-center mt-2">
//             <p className="text-sm text-gray-500">
//               {filteredPayments.filter(p => p.status === 'pending' || p.status === 'overdue').length} pending invoices
//             </p>
//             <span className="text-yellow-500 text-lg">
//               <i className="fas fa-clock"></i>
//             </span>
//           </div>
//         </div>
//         <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md border-l-4 border-red-500 transform transition-transform duration-300 hover:scale-105">
//           <h3 className="text-gray-500 text-sm mb-1">Total Overdue Amount</h3>
//           <p className="text-2xl font-bold text-red-600">₹{totalOverdue.toLocaleString()}</p>
//           <div className="flex justify-between items-center mt-2">
//             <p className="text-sm text-gray-500">
//               {filteredPayments.filter(p => p.status === 'overdue').length} overdue invoices
//             </p>
//             <span className="text-red-500 text-lg">
//               <i className="fas fa-exclamation-circle"></i>
//             </span>
//           </div>
//         </div>
//       </div>

//       {/* Filters and Controls */}
//       <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
//         <h2 className="text-lg font-semibold text-gray-800 mb-4">Filter Invoices</h2>
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//           <div>
//             <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
//             <select
//               id="status-filter"
//               className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
//               value={statusFilter}
//               onChange={e => setStatusFilter(e.target.value)}
//             >
//               <option value="">All Statuses</option>
//               <option value="paid">Paid</option>
//               <option value="pending">Pending</option>
//               <option value="overdue">Overdue</option>
//             </select>
//           </div>
//           <div>
//             <label htmlFor="date-from" className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
//             <input
//               type="date"
//               id="date-from"
//               className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
//               value={dateFrom}
//               onChange={e => setDateFrom(e.target.value)}
//             />
//           </div>
//           <div>
//             <label htmlFor="date-to" className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
//             <input
//               type="date"
//               id="date-to"
//               className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
//               value={dateTo}
//               onChange={e => setDateTo(e.target.value)}
//             />
//           </div>
//         </div>
//         <div className="flex justify-end mt-4">
//           <button onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo(''); }}
//             className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors mr-2">
//             Reset Filters
//           </button>
//         </div>
//       </div>

//       {/* Payments Table & Responsive Cards */}
//       <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
//         <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
//           <h2 className="text-lg font-semibold text-gray-800">Invoice Database</h2>
//           <div className="text-sm text-gray-500">
//             Total: {filteredPayments.length} invoices
//           </div>
//         </div>
//         {/* Responsive: Cards on mobile, table on md+ */}
//         <div className="block md:hidden px-4 py-2">
//           {filteredPayments.map((payment) => (
//             <TableRowCard key={payment.id} payment={payment} onView={(p) => { setSelectedInvoice(p); setModalOpen(true); }} />
//           ))}
//         </div>
//         <div className="overflow-x-auto hidden md:block">
//           <table className="w-full border-collapse">
//             <thead>
//               <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase tracking-wider">
//                 <th className="px-4 py-2 text-left font-semibold">Invoice ID</th>
//                 <th className="px-4 py-2 text-left font-semibold">Client</th>
//                 <th className="px-4 py-2 text-left font-semibold">Amount</th>
//                 <th className="px-4 py-2 text-left font-semibold">Paid</th>
//                 <th className="px-4 py-2 text-left font-semibold">Remaining</th>
//                 <th className="px-4 py-2 text-left font-semibold">Status</th>
//                 <th className="px-4 py-2 text-left font-semibold hidden lg:table-cell">Invoice Date</th>
//                 <th className="px-4 py-2 text-left font-semibold hidden md:table-cell">Due Date</th>
//                 <th className="px-4 py-2 text-left font-semibold hidden lg:table-cell">Payment Date</th>
//                 <th className="px-4 py-2 text-center font-semibold">Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {filteredPayments.map((payment, index) => (
//                 <tr
//                   key={payment.id}
//                   className={`${
//                     index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
//                   } border-b border-gray-100 hover:bg-blue-50 transition-colors`}
//                 >
//                   <td className="px-4 py-3 text-sm text-gray-800 font-medium whitespace-nowrap">{payment.id}</td>
//                   <td className="px-4 py-3 text-sm text-gray-800">
//                     {payment.client}
//                     <div className="text-xs text-gray-500">{payment.clientId}</div>
//                   </td>
//                   <td className="px-4 py-3 text-sm text-gray-800 font-semibold whitespace-nowrap">
//                     ₹{(payment.amount || 0).toLocaleString()}
//                   </td>
//                   <td className="px-4 py-3 text-sm text-green-800 font-semibold whitespace-nowrap">
//                     ₹{(payment.paidAmount || 0).toLocaleString()}
//                   </td>
//                   <td className="px-4 py-3 text-sm text-yellow-800 font-semibold whitespace-nowrap">
//                     ₹{(payment.remainingAmount || 0).toLocaleString()}
//                   </td>
//                   <td className="px-4 py-3 text-sm whitespace-nowrap">
//                     <span
//                       className={`px-2 py-1 inline-flex items-center rounded-full text-xs font-medium ${
//                         payment.status === 'paid'
//                           ? 'bg-green-100 text-green-700 border border-green-200'
//                           : payment.status === 'pending'
//                           ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
//                           : 'bg-red-100 text-red-700 border border-red-200'
//                       }`}
//                     >
//                       {payment.status === 'paid' && <i className="fas fa-check-circle mr-1.5"></i>}
//                       {payment.status === 'pending' && <i className="fas fa-clock mr-1.5"></i>}
//                       {payment.status === 'overdue' && <i className="fas fa-exclamation-circle mr-1.5"></i>}
//                       {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
//                     </span>
//                     <div className="text-xs text-gray-500 mt-1 md:hidden">Due: {payment.dueDate}</div>
//                   </td>
//                   <td className="px-4 py-3 text-xs text-gray-600 hidden lg:table-cell">{payment.invoiceDate}</td>
//                   <td className="px-4 py-3 text-xs text-gray-600 hidden md:table-cell">{payment.dueDate}</td>
//                   <td className="px-4 py-3 text-xs text-gray-600 hidden lg:table-cell">{payment.paymentDate || '—'}</td>
//                   <td className="px-4 py-3 text-center">
//                     <button
//                       className="text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 p-2 rounded shadow transition-all duration-200 transform hover:scale-110"
//                       title="View Invoice"
//                       onClick={() => { setSelectedInvoice(payment); setModalOpen(true); }}
//                     >
//                       <i className="fas fa-eye text-lg"></i>
//                     </button>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default PaymentsPage;