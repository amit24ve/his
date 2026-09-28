import React, { useEffect, useState } from 'react';
import Select from "react-select";

// --- 3D Card Animation Wrapper (Updated) ---
const AnimatedCard = ({ children, className = '', style = {}, onClick }) => {
  return (
    <InteractiveCard
      className={className}
      style={style}
      onClick={onClick}
    >
      {children}
    </InteractiveCard>
  );
};

// --- Enhanced Action Button Component ---
const ActionBtn = ({ icon, label, onClick, color = 'gray', className = '' }) => {
  const [isHovered, setIsHovered] = useState(false);

  const colorMap = {
    gray: 'bg-gray-200 text-gray-700 hover:bg-gray-300',
    green: 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 hover:from-green-500 hover:to-emerald-600 hover:text-white border-green-300',
    red: 'bg-gradient-to-r from-red-100 to-pink-100 text-red-700 hover:from-red-500 hover:to-pink-600 hover:text-white border-red-300',
    blue: 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 hover:from-blue-500 hover:to-indigo-600 hover:text-white border-blue-300',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border-2 transition-all duration-300 whitespace-nowrap transform hover:scale-105 hover:shadow-lg ${colorMap[color] || colorMap.gray} ${className} ${isHovered ? 'shadow-lg' : 'shadow-sm'
        }`}
    >
      <i className={`fas fa-${icon} transition-transform duration-200 ${isHovered ? 'scale-110' : ''}`}></i>
      <span className="hidden sm:inline font-medium">{label}</span>
    </button>
  );
};

// --- Summary Card Component ---
const SummaryCard = ({ title, value, subtitle, color = '' }) => (
  <AnimatedCard className="bg-white p-4 min-h-[110px] flex flex-col justify-between">
    <h3 className="text-sm text-gray-500 mb-1 font-medium">{title}</h3>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    <p className="text-xs text-gray-400 mt-2">{subtitle}</p>
  </AnimatedCard>
);

// --- Modal Card Component (Responsive) ---
const ModalCard = ({ open, onClose, children, width = 'max-w-md' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="flex items-center justify-center w-full h-full px-2 sm:px-4">
        <AnimatedCard
          className={`relative w-[90vw] ${width} p-4 sm:p-6 max-h-[80vh] overflow-y-auto`}
          style={{ boxShadow: '0 16px 40px rgba(0,0,0,0.2)' }}
        >
          <button
            onClick={onClose}
            className="absolute top-2 right-2 sm:right-3 text-gray-400 hover:text-red-500 text-xl sm:text-2xl font-bold z-10"
            aria-label="Close"
          >
            ×
          </button>
          {children}
        </AnimatedCard>
      </div>
    </div>
  );
};

// --- Enhanced Card with 3D Movement Effect ---
const InteractiveCard = ({ children, className = '', style = {}, onClick }) => {
  const [transform, setTransform] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [glowPosition, setGlowPosition] = useState({ x: 50, y: 50 });

  function handleMouseMove(e) {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate rotation based on mouse position
    const rotateX = ((y - centerY) / centerY) * 8;
    const rotateY = ((x - centerX) / centerX) * -8;

    // Calculate glow position as percentage
    const glowX = (x / rect.width) * 100;
    const glowY = (y / rect.height) * 100;

    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02,1.02,1.02)`);
    setGlowPosition({ x: glowX, y: glowY });
  }

  function handleMouseLeave() {
    setTransform('');
    setIsHovered(false);
    setGlowPosition({ x: 50, y: 50 });
  }

  function handleMouseEnter() {
    setIsHovered(true);
  }

  return (
    <div
      className={`transition-all duration-300 ease-out shadow-2xl rounded-2xl relative overflow-hidden ${isHovered ? 'ring-4 ring-blue-300 ring-opacity-60' : ''
        } ${className}`}
      style={{
        transform,
        willChange: 'transform',
        background: isHovered
          ? `radial-gradient(circle at ${glowPosition.x}% ${glowPosition.y}%, rgba(59, 130, 246, 0.1) 0%, transparent 50%), #fff`
          : '#fff',
        ...style,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      onClick={onClick}
    >
      {/* Subtle gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-purple-50/20 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'
        }`} />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

// --- Enhanced Modal Card Component ---
const EnhancedModalCard = ({ open, onClose, children, width = 'max-w-md' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur effect */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="flex items-center justify-center w-full h-full px-2 sm:px-4 relative z-10">
        <InteractiveCard
          className={`relative w-[95vw] ${width} p-6 sm:p-8 max-h-[90vh] overflow-y-auto border border-gray-100`}
          style={{
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
          }}
        >
          {/* Close button with hover effect */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-500 transition-all duration-200 transform hover:scale-110 z-20"
            aria-label="Close"
          >
            <i className="fas fa-times text-sm"></i>
          </button>
          {children}
        </InteractiveCard>
      </div>
    </div>
  );
};

// --- Due Pay Modal Component (Enhanced) ---
const DuePayModal = ({ open, onClose, quotation, onPaid }) => {
  const [payAmount, setPayAmount] = useState(
    quotation?.remaining_amount !== undefined && quotation?.remaining_amount !== null
      ? quotation.remaining_amount.toString()
      : ''
  );
  const [paymentTitle, setPaymentTitle] = useState(''); // New state for payment title
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (open && quotation) {
      setPayAmount(
        quotation.remaining_amount !== undefined && quotation.remaining_amount !== null
          ? quotation.remaining_amount.toString()
          : ''
      );
      setPaymentTitle(''); // Reset payment title
      setError('');
      setSuccess(false);
      setRefreshing(false);
    }
  }, [open, quotation]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess(false);

    const amountNum = Math.round(parseFloat(payAmount) * 100) / 100; // Round to 2 decimal places to avoid precision issues

    console.log('Payment Debug:', {
      originalInput: payAmount,
      parsedAmount: parseFloat(payAmount),
      finalAmount: amountNum,
      remainingAmount: quotation.remaining_amount
    });

    if (amountNum <= 0 || amountNum > (quotation.remaining_amount || 0)) {
      setError('Enter a valid payment amount.');
      setSubmitting(false);
      return;
    }

    if (!paymentTitle.trim()) {
      setError('Please enter a payment title/description.');
      setSubmitting(false);
      return;
    }

    try {
      const requestBody = {
        amount: amountNum,
        payment_title: paymentTitle.trim()
      };

      console.log('Sending payment request:', requestBody);

      const token = localStorage.getItem('access_token') || '';
      const res = await fetch(`https://cubehis.avopay.pro:5000/api/quotations/${quotation.lead_id}/duepay`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        let msg = 'Failed to process payment.';
        try {
          const data = await res.json();
          msg = data.message || msg;
        } catch {
          /* ignore */
        }
        setError(msg);
        setSubmitting(false);
        return;
      }

      // Get the response data to show exact processed amount
      const responseData = await res.json();
      console.log('Payment response:', responseData);

      setSuccess(true);
      setRefreshing(true);

      // Immediately refresh the quotations data
      if (onPaid) {
        await onPaid();
      }

      setRefreshing(false);

      setTimeout(() => {
        setSuccess(false);
        setSubmitting(false);
        onClose();
      }, 1500);
    } catch (e) {
      setError('Failed to process payment.');
      setSubmitting(false);
    }
  };

  if (!open || !quotation) return null;
  return (
    <EnhancedModalCard open={open} onClose={onClose} width="max-w-md sm:max-w-lg md:max-w-2xl">
      {/* Header with gradient */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
            <i className="fas fa-credit-card text-white text-xl"></i>
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-700 bg-clip-text text-transparent">
              Pay Due Amount
            </h2>
            <p className="text-gray-500 text-sm">Process payment for quotation</p>
          </div>
        </div>
      </div>

      {/* Quotation Summary Card */}
      <InteractiveCard className="mb-6 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
          <i className="fas fa-file-invoice-dollar"></i>
          Quotation Summary
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 font-medium">Quotation ID:</span>
              <span className="font-semibold text-blue-700">{quotation.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 font-medium">Total Amount:</span>
              <span className="font-bold text-green-700">₹{(quotation.amount || 0).toLocaleString()}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 font-medium">Paid Amount:</span>
              <span className="font-bold text-blue-700">₹{(quotation.paid_amount || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 font-medium">Remaining:</span>
              <span className="font-bold text-orange-600">₹{(quotation.remaining_amount || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </InteractiveCard>

      {/* Product Payment Status Section */}
      <InteractiveCard className="mb-6 p-5 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200">
        <h3 className="text-lg font-semibold text-purple-800 mb-4 border-b border-purple-200 pb-3 flex items-center gap-2">
          <i className="fas fa-shopping-cart text-purple-600"></i>
          Product Payments & Status
        </h3>
        {(quotation.milestones || []).length > 0 ? (
          <div className="grid gap-4">
            {quotation.milestones.map((milestone, idx) => (
              <InteractiveCard
                key={idx}
                className={`p-4 border-2 transition-all ${milestone.paid
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
                    : 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-300'
                  }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${milestone.paid ? 'bg-green-100' : 'bg-orange-100'
                        }`}>
                        <i className={`fas fa-box ${milestone.paid ? 'text-green-600' : 'text-orange-600'}`}></i>
                      </div>
                      <div className="font-semibold text-gray-900 text-base">
                        {milestone.title || `Product Payment ${idx + 1}`}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 ml-13">
                      Payment Amount: <span className="font-bold text-green-700">₹{(milestone.amount || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <span
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold shadow-lg ${milestone.paid
                          ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border-2 border-green-300'
                          : 'bg-gradient-to-r from-orange-100 to-yellow-100 text-orange-700 border-2 border-orange-300'
                        }`}
                    >
                      <i className={`fas fa-${milestone.paid ? 'check-circle' : 'clock'}`}></i>
                      {milestone.paid ? 'Payment Done' : 'Pending Payment'}
                    </span>
                  </div>
                </div>
              </InteractiveCard>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-shopping-bag text-gray-400 text-2xl"></i>
            </div>
            <div className="text-gray-500 text-sm italic">
              No product payments configured
            </div>
          </div>
        )}
      </InteractiveCard>

      {/* Payment Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <InteractiveCard className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <i className="fas fa-money-bill-wave text-green-600"></i>
            Payment Details
          </h3>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-3 text-gray-700 flex items-center gap-2">
                <i className="fas fa-tag text-blue-600"></i>
                Payment Title/Description
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="border-2 border-gray-200 p-4 rounded-xl w-full focus:ring-4 focus:ring-blue-200 focus:border-blue-400 text-base transition-all duration-200 bg-white hover:border-blue-300"
                value={paymentTitle}
                onChange={(e) => setPaymentTitle(e.target.value)}
                placeholder="e.g., Final Payment, Balance Amount, Product Delivery, etc."
              />
              <div className="text-xs text-gray-600 mt-2 flex items-center gap-1 bg-blue-50 p-2 rounded-lg">
                <i className="fas fa-info-circle text-blue-500"></i>
                Enter a descriptive title for this payment
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-3 text-gray-700 flex items-center gap-2">
                <i className="fas fa-money-bill-wave text-green-600"></i>
                Pay Amount
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-green-600 font-bold text-lg">₹</span>
                <input
                  type="number"
                  min="0"
                  max={quotation.remaining_amount || 1}
                  step="1"
                  required
                  className="border-2 border-gray-200 p-4 pl-12 rounded-xl w-full focus:ring-4 focus:ring-green-200 focus:border-green-400 text-xl font-bold transition-all duration-200 bg-white hover:border-green-300"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Enter payment amount"
                />
              </div>
              <div className="text-xs text-gray-600 mt-2 flex items-center gap-1 bg-green-50 p-2 rounded-lg">
                <i className="fas fa-info-circle text-green-500"></i>
                You can pay any amount up to the remaining due amount of ₹{(quotation.remaining_amount || 0).toLocaleString()}
              </div>
            </div>
          </div>
        </InteractiveCard>

        {/* Status Messages */}
        {error && (
          <InteractiveCard className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <i className="fas fa-exclamation-triangle text-red-500"></i>
              </div>
              <span className="text-red-700 font-medium">{error}</span>
            </div>
          </InteractiveCard>
        )}

        {success && (
          <InteractiveCard className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <i className={`fas ${refreshing ? 'fa-spinner fa-spin' : 'fa-check-circle'} text-green-500`}></i>
              </div>
              <span className="text-green-700 font-medium">
                Payment successful! "{paymentTitle}" - ₹{Math.round(parseFloat(payAmount || '0') * 100) / 100} has been processed.
                {refreshing ? ' Updating data...' : ' Data updated!'}
              </span>
            </div>
          </InteractiveCard>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || !payAmount || !paymentTitle.trim() || (Math.round(parseFloat(payAmount) * 100) / 100) < 1}
          className="w-full bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 hover:from-green-700 hover:via-emerald-700 hover:to-green-800 text-white font-bold rounded-xl px-8 py-4 shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg transform hover:scale-105 hover:shadow-2xl"
        >
          {submitting ? (
            <>
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processing Payment...
            </>
          ) : (
            <>
              <i className="fas fa-credit-card text-xl"></i>
              Pay ₹{payAmount ? (Math.round(parseFloat(payAmount) * 100) / 100).toLocaleString() : '0'}
              {paymentTitle && ` - ${paymentTitle}`}
            </>
          )}
        </button>
      </form>
    </EnhancedModalCard>
  );
};

// --- Quotation Details Modal Component (Responsive) ---
const QuotationDetailsModal = ({ quotation, open, onClose, onInvoice }) => {
  if (!open || !quotation) return null;
  return (
    <ModalCard open={open} onClose={onClose} width="max-w-sm sm:max-w-md md:max-w-xl">
      <h2 className="text-xl sm:text-2xl font-bold text-blue-700 mb-3 sm:mb-4">Quotation Details</h2>
      <div className="space-y-2 sm:space-y-3 mb-4 text-sm sm:text-base">
        <div>
          <strong>Quotation ID:</strong> {quotation.id}
        </div>
        <div>
          <strong>Lead ID:</strong> {quotation.lead_id}
        </div>
        <div>
          <strong>Client Name:</strong> {quotation.client}
        </div>
        <div>
          <strong>Total Cost:</strong> ₹{(quotation.amount || 0).toLocaleString()}
        </div>
        <div>
          <strong>Paid Amount:</strong> ₹{(quotation.paid_amount || 0).toLocaleString()}
        </div>
        <div>
          <strong>Remaining Amount:</strong> ₹{(quotation.remaining_amount || 0).toLocaleString()}
        </div>
        <div>
          <strong>Status:</strong> {quotation.status}
        </div>
        <div>
          <strong>Created:</strong> {quotation.createdDate}
        </div>
        <div>
          <strong>Expiry Date:</strong> {quotation.expiryDate ? quotation.expiryDate.split('T')[0] : '-'}
        </div>
      </div>
      <div>
        <strong>Payment Milestones:</strong>
        <ul className="mt-2 space-y-2">
          {(quotation.milestones || []).length > 0 ? (
            quotation.milestones.map((m, idx) => (
              <li
                key={idx}
                className={`border rounded-lg p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${m.paid ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}
              >
                <span className="text-sm flex-1">
                  <div className="font-semibold text-gray-900 mb-1">
                    {m.title || `Payment ${idx + 1}`}
                  </div>
                  <div className="text-gray-600">
                    Amount: <span className="font-medium">₹{(m.amount || 0).toLocaleString()}</span>
                  </div>
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${m.paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}
                >
                  {m.paid ? '✓ Paid' : '⏳ Unpaid'}
                </span>
              </li>
            ))
          ) : (
            <li className="text-gray-500 text-sm italic text-center py-4">No payment milestones</li>
          )}
        </ul>
      </div>
      <div className="mt-4">
        <button
          onClick={() => onInvoice && onInvoice(quotation.lead_id)}
          className="inline-flex items-center gap-1 px-3 py-1 rounded text-sm border border-gray-200 bg-gray-50 hover:bg-blue-100 transition"
        >
          <i className="fas fa-file-invoice text-blue-500"></i>
          Invoice
        </button>
      </div>
    </ModalCard>
  );
};


const NewQuotationModal = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState({
    lead_id: '',
    client_name: '',
    amount: '',
    milestones: [{ title: '', amount: '', paid: false }],
    // New lead fields for "Lead Not Found" option
    contact_no: '',
    location: '',
    email: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [leadOptions, setLeadOptions] = useState([]);
  const [leadsMap, setLeadsMap] = useState({}); // To lookup lead by id
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [isNewLead, setIsNewLead] = useState(false); // Track if "Lead Not Found" is selected

  useEffect(() => {
    if (!open) {
      setForm({
        lead_id: '',
        client_name: '',
        amount: '',
        milestones: [{ title: '', amount: '', paid: false }],
        contact_no: '',
        location: '',
        email: '',
      });
      setError('');
      setIsNewLead(false);
    }
  }, [open]);

  // Fetch all leads for the select dropdown
  useEffect(() => {
    if (!open) return;
    setLeadsLoading(true);
    const token = localStorage.getItem('access_token') || '';
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    fetch('https://cubehis.avopay.pro:5000/api/lead/leads?limit=1000', { headers })
      .then(res => res.json())
      .then(data => {
        const options = (data.data || []).map(l => ({
          value: l.lead_id || l._id || l.lead_key,
          label: `${l.lead_id || l._id || l.lead_key} - ${l.name || l.client_name || l.raw_data?.Name || l.email || ""}`,
          lead: l,
        }));

        // Add "Lead Not Found" option at the beginning
        options.unshift({
          value: 'new_lead',
          label: 'Lead Not Found - Create New Lead',
          lead: null,
        });

        setLeadOptions(options);
        // Prepare a map for fast lookup
        const map = {};
        options.forEach(opt => {
          if (opt.value !== 'new_lead') {
            map[opt.value] = opt.lead;
          }
        });
        setLeadsMap(map);
      })
      .catch(() => {
        setLeadOptions([{
          value: 'new_lead',
          label: 'Lead Not Found - Create New Lead',
          lead: null,
        }]);
        setLeadsMap({});
      })
      .finally(() => setLeadsLoading(false));
  }, [open]);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  // Update: When selecting a lead, auto-fill the client_name from that lead
  const handleLeadSelect = (selected) => {
    if (selected) {
      if (selected.value === 'new_lead') {
        // "Lead Not Found" option selected
        setIsNewLead(true);
        setForm((f) => ({
          ...f,
          lead_id: 'new_lead',
          client_name: '',
          contact_no: '',
          location: '',
          email: '',
        }));
      } else {
        // Existing lead selected
        setIsNewLead(false);
        const lead = leadsMap[selected.value];
        setForm((f) => ({
          ...f,
          lead_id: selected.value,
          client_name: lead?.name || lead?.client_name || lead?.raw_data?.Name || lead?.email || "",
          contact_no: '',
          location: '',
          email: '',
        }));
      }
    } else {
      setIsNewLead(false);
      setForm((f) => ({
        ...f,
        lead_id: '',
        client_name: '',
        contact_no: '',
        location: '',
        email: '',
      }));
    }
  };

  const handleMilestoneChange = (idx, field, value) => {
    setForm((f) => ({
      ...f,
      milestones: f.milestones.map((m, i) => (i === idx ? { ...m, [field]: value } : m)),
    }));
  };

  const addMilestone = () => {
    setForm((f) => ({
      ...f,
      milestones: [...f.milestones, { title: '', amount: '', paid: false }],
    }));
  };

  const removeMilestone = (idx) => {
    setForm((f) => ({
      ...f,
      milestones: f.milestones.filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const milestones = form.milestones.map((m) => ({
      title: m.title,
      amount: parseFloat(m.amount) || 0,
      paid: !!m.paid,
    }));

    const paidAmount = milestones.filter((m) => m.paid).reduce((sum, m) => sum + m.amount, 0);
    const totalAmount = parseFloat(form.amount) || 0;
    if (paidAmount > totalAmount) {
      setError('Paid Amount is more than Total Amount.');
      setSubmitting(false);
      return;
    }

    // Validation for new lead creation
    if (isNewLead) {
      if (!form.client_name || !form.email || !form.contact_no) {
        setError('Client Name, Email, and Contact Number are required for new lead.');
        setSubmitting(false);
        return;
      }
    }

    try {
      let leadId = form.lead_id;

      // If "Lead Not Found" is selected, create a new lead first
      if (isNewLead) {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');

        const leadPayload = {
          name: form.client_name.trim(),
          email: form.email.trim(),
          phone: form.contact_no.trim(),
          location: form.location.trim(),
          notes: `Lead created from quotation on ${new Date().toLocaleDateString()}`,
          status: "new",
          campaign: "Quotation Lead",
          source: "quotation_creation",
          created_by: currentUser.user_id || currentUser.full_name || "user"
        };

        console.log("Creating new lead:", leadPayload);

        const leadRes = await fetch("https://cubehis.avopay.pro:5000/api/lead/leads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { "Authorization": `Bearer ${token}` })
          },
          body: JSON.stringify(leadPayload),
        });

        const leadData = await leadRes.json();
        console.log("Lead creation response:", leadData);

        if (!leadRes.ok) {
          throw new Error(leadData.detail || "Failed to create lead");
        }

        // Use the created lead ID
        leadId = leadData.lead_id || leadData._id || leadData.id;
        if (!leadId) {
          throw new Error("Lead created but no ID returned");
        }
      }

      // Create the quotation
      const payload = {
        lead_id: leadId,
        client_name: form.client_name,
        amount: totalAmount,
        milestones,
      };

      console.log("Creating quotation:", payload);

      const res = await fetch('https://cubehis.avopay.pro:5000/api/quotations/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!res.ok) throw new Error(data.detail || 'Failed to create quotation');

      onCreated && onCreated();
      onClose();
    } catch (e) {
      console.error('Error:', e);
      setError(e.message);
    }
    setSubmitting(false);
  };

  const paidAmount = form.milestones.reduce((sum, m) => sum + (m.paid ? parseFloat(m.amount) || 0 : 0), 0);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-sm sm:max-w-md md:max-w-lg relative flex flex-col max-h-[80vh]">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 sm:right-3 text-gray-400 hover:text-red-500 text-xl sm:text-2xl font-bold z-10"
          aria-label="Close"
        >
          ×
        </button>
        <div className="overflow-y-auto p-4 sm:p-5 flex-1">
          <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-5 text-blue-700">Create New Quotation</h2>
          <form className="space-y-3 sm:space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium mb-1">
                Lead ID <span className="text-red-500">*</span>
              </label>
              <Select
                value={leadOptions.find(opt => opt.value === form.lead_id) || null}
                onChange={handleLeadSelect}
                options={leadOptions}
                isLoading={leadsLoading}
                isClearable
                placeholder="Select Lead..."
                className="react-select-container"
                classNamePrefix="react-select"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Client Name <span className="text-red-500">*</span>
              </label>
              <input
                name="client_name"
                required
                className="border p-2 rounded w-full focus:ring focus:ring-blue-200"
                value={form.client_name}
                onChange={handleChange}
                placeholder="Client Name"
              />
            </div>

            {/* Additional fields for new lead creation */}
            {isNewLead && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    className="border p-2 rounded w-full focus:ring focus:ring-blue-200"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="client@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Contact Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="contact_no"
                    type="tel"
                    required
                    className="border p-2 rounded w-full focus:ring focus:ring-blue-200"
                    value={form.contact_no}
                    onChange={handleChange}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Location
                  </label>
                  <input
                    name="location"
                    className="border p-2 rounded w-full focus:ring focus:ring-blue-200"
                    value={form.location}
                    onChange={handleChange}
                    placeholder="City, State"
                  />
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 text-blue-700">
                    <i className="fas fa-info-circle"></i>
                    <span className="font-semibold">Creating New Lead</span>
                  </div>
                  <p className="text-blue-600 mt-1">
                    Since no existing lead was found, a new lead will be created with the information above, and then the quotation will be linked to this new lead.
                  </p>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">
                Total Cost <span className="text-red-500">*</span>
              </label>
              <input
                name="amount"
                type="number"
                min="0"
                required
                className="border p-2 rounded w-full focus:ring focus:ring-blue-200"
                value={form.amount}
                onChange={handleChange}
              />
              <div className="text-xs mt-1">
                <span className="font-semibold text-gray-700">Total Paid : </span>
                <span
                  className={`font-semibold ${paidAmount > parseFloat(form.amount || '0') ? 'text-red-600' : 'text-green-700'
                    }`}
                >
                  ₹{paidAmount.toLocaleString()}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Amount Recieved</label>
              {form.milestones.map((m, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2 mb-2">
                  <input
                    className="border p-2 rounded w-full sm:w-1/2 focus:ring focus:ring-blue-200"
                    placeholder="Title"
                    value={m.title}
                    onChange={(e) => handleMilestoneChange(idx, 'title', e.target.value)}
                  />
                  <input
                    className="border p-2 rounded w-full sm:w-1/3 focus:ring focus:ring-blue-200"
                    placeholder="Amount"
                    type="number"
                    min="0"
                    value={m.amount}
                    onChange={(e) => handleMilestoneChange(idx, 'amount', e.target.value)}
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={!!m.paid}
                      onChange={(e) => handleMilestoneChange(idx, 'paid', e.target.checked)}
                    />
                    Paid
                  </label>
                  {form.milestones.length > 1 && (
                    <button
                      type="button"
                      className="text-red-500 font-bold"
                      onClick={() => removeMilestone(idx)}
                      aria-label="Remove milestone"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="text-xs text-blue-600 underline mt-1"
                onClick={addMilestone}
              >
                + Add Milestone
              </button>
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded px-4 py-2 mt-2 shadow-sm transition"
            >
              {submitting ? 'Creating...' : 'Create Quotation'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// --- Quotations Page Component ---
const QuotationsPage = () => {
  const [quotations, setQuotations] = useState([]);
  const [summary, setSummary] = useState({
    total_amount: 0,
    acceptance_amount: 0,
    acceptance_rate: 0,
  });
  const [progressMap, setProgressMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewQuotation, setShowNewQuotation] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsQuotation, setDetailsQuotation] = useState(null);
  const [duePayOpen, setDuePayOpen] = useState(false);
  const [duePayQuotation, setDuePayQuotation] = useState(null);
  const [refreshingData, setRefreshingData] = useState(false);

  useEffect(() => {
    document.title = 'B2B CRM - Quotations';
    fetchQuotations();
    // eslint-disable-next-line
  }, []);

  const fetchQuotations = async () => {
    setLoading(true);
    setRefreshingData(true);
    setError(null);
    try {
      const res = await fetch('https://cubehis.avopay.pro:5000/api/quotations/', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch quotations');
      const data = await res.json();
      const formatted = (data.quotations || []).map((q, i) => ({
        id: q.quotation_number || q.quotation_id || q.id || `Q-${q.lead_id || i}`,
        client: q.client_name || q.client || '',
        clientId: q.client_id || '',
        amount: q.amount || 0,
        paid_amount: q.paid_amount || 0,
        remaining_amount: q.remaining_amount || 0,
        status: q.status || 'draft',
        createdDate: q.created_at ? q.created_at.split('T')[0] : '',
        expiryDate: q.expiry_date || '',
        items: q.milestones ? q.milestones.length : (q.items || 0),
        followUpDate: q.follow_up_date || null,
        pdf_url: q.pdf_url || null,
        lead_id: q.lead_id || null,
        milestones: q.milestones || [],
      }));
      setQuotations(formatted);
      setSummary(data.summary || { total_amount: 0, acceptance_amount: 0, acceptance_rate: 0 });
      fetchAllProgress(formatted);
    } catch (err) {
      setError('Could not load quotations.');
      setQuotations([]);
      setSummary({ total_amount: 0, acceptance_amount: 0, acceptance_rate: 0 });
    } finally {
      setLoading(false);
      setRefreshingData(false);
    }
  };

  const fetchAllProgress = async (list) => {
    const entries = await Promise.all(
      list
        .filter((q) => q.lead_id)
        .map(async (q) => {
          try {
            const res = await fetch(`https://cubehis.avopay.pro:5000/api/quotations/${q.lead_id}/progress`, {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
              },
            });
            if (!res.ok) return [q.lead_id, null];
            const progress = await res.json();
            return [q.lead_id, progress];
          } catch {
            return [q.lead_id, null];
          }
        })
    );
    const progressObj = {};
    entries.forEach(([lead_id, progress]) => {
      if (lead_id && progress) progressObj[lead_id] = progress;
    });
    setProgressMap(progressObj);
  };

  const handleInvoice = async (lead_id) => {
    try {
      const res = await fetch(`https://cubehis.avopay.pro:5000/api/quotations/${lead_id}/invoice`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
      });
      if (!res.ok) {
        alert('Failed to generate invoice.');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      alert('Failed to generate invoice.');
    }
  };

  const handleAccept = async (id) => {
    const q = quotations.find((q) => q.id === id);
    if (!q) return;
    try {
      const lastMilestoneIndex = (q.items || 1) - 1;
      if (q.lead_id && lastMilestoneIndex >= 0) {
        await fetch(`https://cubehis.avopay.pro:5000/api/quotations/${q.lead_id}/milestone/${lastMilestoneIndex}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
          },
          body: JSON.stringify({ paid: true }),
        });
      }
      setQuotations((prev) => prev.map((qn) => (qn.id === id ? { ...qn, status: 'accepted', followUpDate: null } : qn)));
      fetchAllProgress([q]);
    } catch (err) {
      alert('Failed to accept quotation');
    }
  };

  const handleReject = async (id) => {
    setQuotations((prev) => prev.map((q) => (q.id === id ? { ...q, status: 'rejected', followUpDate: null } : q)));
  };

  const handleShowDetails = (quotation) => {
    setDetailsQuotation(quotation);
    setDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setDetailsQuotation(null);
  };

  const handleDuePay = (quotation) => {
    setDuePayQuotation(quotation);
    setDuePayOpen(true);
  };

  const handleCloseDuePay = () => {
    setDuePayOpen(false);
    setDuePayQuotation(null);
  };

  if (loading) return <div className="p-8 text-center text-blue-600 font-semibold text-lg">Loading quotations...</div>;
  if (error) return <div className="p-8 text-center text-red-600 font-semibold text-lg">{error}</div>;

  return (
    <div className="p-4 md:p-8 space-y-8 bg-gray-50 min-h-screen">
      <QuotationDetailsModal
        quotation={detailsQuotation}
        open={detailsOpen}
        onClose={handleCloseDetails}
        onInvoice={handleInvoice}
      />
      <DuePayModal
        open={duePayOpen}
        onClose={handleCloseDuePay}
        quotation={duePayQuotation}
        onPaid={fetchQuotations}
      />
      <NewQuotationModal
        open={showNewQuotation}
        onClose={() => setShowNewQuotation(false)}
        onCreated={fetchQuotations}
      />

      <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            Quotations
            {refreshingData && (
              <div className="flex items-center gap-2 text-blue-600 text-base font-normal">
                <i className="fas fa-spinner fa-spin"></i>
                <span className="text-sm">Updating...</span>
              </div>
            )}
          </h1>
          <p className="text-base text-gray-600 mt-1">Manage all your quotations and proposals in one place.</p>
        </div>
        <div className="text-sm text-gray-600 mt-4 md:mt-0 flex flex-col items-end">
          <div>
            <i className="fas fa-calendar-alt mr-2" />
            {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Total Quotations" value={quotations.length} subtitle="Count of all quotations" />
        <SummaryCard title="Total Value" value={`₹${summary.total_amount.toLocaleString()}`} subtitle="All quotations total" />
        <SummaryCard
          title="Acceptance Amount"
          value={`₹${summary.acceptance_amount.toLocaleString()}`}
          subtitle="Total paid"
          color="text-green-600"
        />
        <SummaryCard
          title="Acceptance Rate"
          value={`${summary.acceptance_rate}%`}
          subtitle="Paid / Total Amount"
          color="text-green-600"
        />
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap justify-between items-center gap-4 bg-white p-4 rounded-xl shadow">
        <div className="flex gap-2 flex-wrap items-center">
          <label className="text-sm">Status:</label>
          <select className="p-2 border rounded text-sm bg-gray-50 focus:ring focus:ring-blue-200">
            <option>All</option>
            <option>Draft</option>
            <option>Sent</option>
            <option>Accepted</option>
            <option>Rejected</option>
          </select>
          <label className="text-sm ml-2">Date:</label>
          <input type="date" className="p-2 border rounded text-sm bg-gray-50 focus:ring focus:ring-blue-200" />
          <span className="text-sm">to</span>
          <input type="date" className="p-2 border rounded text-sm bg-gray-50 focus:ring focus:ring-blue-200" />
        </div>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium flex items-center gap-2 shadow"
          onClick={() => setShowNewQuotation(true)}
        >
          <i className="fas fa-plus" /> New Quotation
        </button>
      </div>

      {/* Card Layout for Small Screens */}
      <div className={`md:hidden grid grid-cols-1 gap-4 ${refreshingData ? 'opacity-70 pointer-events-none' : ''}`}>
        {quotations.map((q) => (
          <AnimatedCard key={q.id} className="bg-white p-4 space-y-3">
            <div className="flex justify-between items-start">
              <span
                className="text-sm font-semibold text-blue-700 cursor-pointer underline"
                onClick={() => handleShowDetails(q)}
              >
                {q.id}
              </span>
              <span
                className={`text-xs py-1 px-2 rounded-full font-semibold ${q.status === 'sent'
                    ? 'bg-blue-100 text-blue-600'
                    : q.status === 'draft'
                      ? 'bg-gray-200 text-gray-700'
                      : q.status === 'accepted' || q.status === 'paid'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                  }`}
              >
                {q.status === 'paid' ? 'Paid' : q.status.charAt(0).toUpperCase() + q.status.slice(1)}
              </span>
            </div>
            <div>
              <div className="font-medium text-gray-900 text-sm">{q.client}</div>
              <div className="text-xs text-gray-500">{q.clientId}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Total:</span>
                <div className="font-medium text-green-700">₹{(q.amount || 0).toLocaleString()}</div>
              </div>
              <div>
                <span className="text-gray-500">Paid:</span>
                <div className="font-medium text-blue-700">₹{(q.paid_amount || 0).toLocaleString()}</div>
              </div>
              <div>
                <span className="text-gray-500">Remaining:</span>
                <div className="font-medium text-yellow-700">₹{(q.remaining_amount || 0).toLocaleString()}</div>
              </div>
              <div>
                <span className="text-gray-500">Created:</span>
                <div className="text-sm">{q.createdDate}</div>
              </div>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Progress:</span>
              {progressMap[q.lead_id] ? (
                <div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${Math.round(progressMap[q.lead_id].progress * 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs">
                    ₹{progressMap[q.lead_id].paid.toLocaleString()} / ₹{progressMap[q.lead_id].total.toLocaleString()} (
                    {Math.round(progressMap[q.lead_id].progress * 100)}%)
                  </span>
                </div>
              ) : (
                <span className="text-xs text-gray-400">-</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionBtn icon="money-check-alt" label="Due Pay" color="green" onClick={() => handleDuePay(q)} />
              <ActionBtn icon="file-invoice" label="Invoice" color="blue" onClick={() => handleInvoice(q.lead_id)} />
              {q.status === 'sent' && (
                <>
                  <ActionBtn icon="check" label="Accept" onClick={() => handleAccept(q.id)} color="green" />
                  <ActionBtn icon="times" label="Reject" onClick={() => handleReject(q.id)} color="red" />
                </>
              )}
            </div>
          </AnimatedCard>
        ))}
      </div>

      {/* Table Layout for Medium and Larger Screens */}
      <div className={`hidden md:block overflow-x-auto ${refreshingData ? 'opacity-70 pointer-events-none' : ''}`}>
        <table className="w-full min-w-[1050px] bg-white shadow rounded-xl">
          <thead>
            <tr className="bg-gray-100 text-left text-base">
              <th className="p-3">ID</th>
              <th className="p-3">Client</th>
              <th className="p-3">Total Amount</th>
              <th className="p-3">Paid Amount</th>
              <th className="p-3">Remaining</th>
              <th className="p-3">Status</th>
              <th className="p-3">Progress</th>
              <th className="p-3">Created</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotations.map((q) => (
              <tr key={q.id} className="border-t hover:bg-blue-50 transition">
                <td
                  className="p-3 text-sm font-semibold text-blue-700 cursor-pointer underline"
                  onClick={() => handleShowDetails(q)}
                >
                  {q.id}
                </td>
                <td className="p-3 text-sm">
                  <div className="font-medium text-gray-900">{q.client}</div>
                  <div className="text-xs text-gray-500">{q.clientId}</div>
                </td>
                <td className="p-3 text-sm font-medium text-green-700">₹{(q.amount || 0).toLocaleString()}</td>
                <td className="p-3 text-sm font-medium text-blue-700">₹{(q.paid_amount || 0).toLocaleString()}</td>
                <td className="p-3 text-sm font-medium text-yellow-700">₹{(q.remaining_amount || 0).toLocaleString()}</td>
                <td className="p-3">
                  <span
                    className={`text-xs py-1 px-2 rounded-full inline-block font-semibold ${q.status === 'sent'
                        ? 'bg-blue-100 text-blue-600'
                        : q.status === 'draft'
                          ? 'bg-gray-200 text-gray-700'
                          : q.status === 'accepted' || q.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                  >
                    {q.status === 'paid' ? 'Paid' : q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                  </span>
                </td>
                <td className="p-3 text-sm">
                  {progressMap[q.lead_id] ? (
                    <div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${Math.round(progressMap[q.lead_id].progress * 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs">
                        ₹{progressMap[q.lead_id].paid.toLocaleString()} / ₹{progressMap[q.lead_id].total.toLocaleString()} (
                        {Math.round(progressMap[q.lead_id].progress * 100)}%)
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
                <td className="p-3 text-sm">{q.createdDate}</td>
                <td className="p-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <ActionBtn icon="money-check-alt" label="Due Pay" color="green" onClick={() => handleDuePay(q)} />
                    <ActionBtn icon="file-invoice" label="Invoice" color="blue" onClick={() => handleInvoice(q.lead_id)} />
                    {q.status === 'sent' && (
                      <>
                        <ActionBtn icon="check" label="Accept" onClick={() => handleAccept(q.id)} color="green" />
                        <ActionBtn icon="times" label="Reject" onClick={() => handleReject(q.id)} color="red" />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center text-sm bg-gray-100 p-3 rounded-xl mt-4">
        <div className="mb-2 sm:mb-0">Showing 1-{quotations.length} of {quotations.length} quotations</div>
        <div className="flex gap-2">
          <button disabled className="px-2 py-1 rounded bg-gray-200">
            <i className="fas fa-chevron-left" />
          </button>
          <button className="px-3 py-1 rounded bg-blue-600 text-white">1</button>
          <button disabled className="px-2 py-1 rounded bg-gray-200">
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuotationsPage;