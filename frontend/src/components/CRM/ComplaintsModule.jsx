// // src/components/crm/ComplaintsModule.jsx
// import React, { useState } from 'react';

// const ComplaintsModule = () => {
//   const [complaints, setComplaints] = useState([]);
//   const [formData, setFormData] = useState({
//     subject: '',
//     description: '',
//     status: 'Pending',
//   });

//   const handleChange = (e) => {
//     setFormData(prev => ({
//       ...prev,
//       [e.target.name]: e.target.value,
//     }));
//   };

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     if (!formData.subject || !formData.description) return;

//     const newComplaint = {
//       ...formData,
//       id: Date.now(),
//       date: new Date().toLocaleDateString(),
//     };

//     setComplaints([newComplaint, ...complaints]);
//     setFormData({ subject: '', description: '', status: 'Pending' });
//   };

//   return (
//     <div className="p-4 bg-white rounded shadow-md mt-6">
//       <h2 className="text-xl font-semibold mb-3">Complaint / Service Request</h2>

//       <form onSubmit={handleSubmit} className="mb-4 space-y-3">
//         <input
//           type="text"
//           name="subject"
//           placeholder="Subject"
//           className="w-full border p-2 rounded"
//           value={formData.subject}
//           onChange={handleChange}
//         />
//         <textarea
//           name="description"
//           placeholder="Description"
//           rows="3"
//           className="w-full border p-2 rounded"
//           value={formData.description}
//           onChange={handleChange}
//         ></textarea>
//         <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
//           Submit Complaint
//         </button>
//       </form>

//       <div>
//         <h3 className="font-medium mb-2">Complaint History</h3>
//         {complaints.length === 0 ? (
//           <p>No complaints submitted yet.</p>
//         ) : (
//           <ul className="space-y-2 text-sm">
//             {complaints.map((comp) => (
//               <li key={comp.id} className="border p-2 rounded">
//                 <p><strong>{comp.date}</strong> - {comp.subject}</p>
//                 <p>{comp.description}</p>
//                 <p className="text-blue-600">Status: {comp.status}</p>
//               </li>
//             ))}
//           </ul>
//         )}
//       </div>
//     </div>
//   );
// };

// export default ComplaintsModule;


import React, { useState, useEffect } from 'react';

// Pass customerId as a prop to this component
const ComplaintsModule = ({ customerId }) => {
  const [complaints, setComplaints] = useState([]);
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Fetch complaints (feedbacks) from backend
  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    fetch(`/api/customers/${customerId}/history`)
      .then(res => res.json())
      .then(data => {
        // Feedbacks from FastAPI endpoint
        if (Array.isArray(data.feedbacks)) {
          setComplaints(data.feedbacks.map(fb => ({
            id: fb.feedback_id || fb.id || fb._id,
            date: fb.created_at ? new Date(fb.created_at).toLocaleDateString() : "",
            subject: fb.type === 'complaint' ? fb.subject || "Complaint" : (fb.subject || "Feedback"),
            description: fb.content,
            status: fb.status || 'Pending',
          })));
        }
        setErr("");
      })
      .catch(() => setErr("Failed to load complaints"))
      .finally(() => setLoading(false));
  }, [customerId]);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.subject || !formData.description) return;
    setLoading(true);
    setErr("");

    // Prepare payload for feedback
    const payload = {
      user_id: customerId,
      content: formData.description,
      subject: formData.subject,
      type: 'complaint', // or 'feedback'
      status: 'Pending',
      created_at: new Date().toISOString(),
    };

    try {
      const res = await fetch(`/api/customers/${customerId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to submit complaint");
      // Re-fetch complaints after submit
      setFormData({ subject: '', description: '' });
      setErr("");
      // Optionally push new complaint to the list optimistically here
      setTimeout(() => {
        // re-fetch to include the new complaint
        fetch(`/api/customers/${customerId}/history`)
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data.feedbacks)) {
              setComplaints(data.feedbacks.map(fb => ({
                id: fb.feedback_id || fb.id || fb._id,
                date: fb.created_at ? new Date(fb.created_at).toLocaleDateString() : "",
                subject: fb.type === 'complaint' ? fb.subject || "Complaint" : (fb.subject || "Feedback"),
                description: fb.content,
                status: fb.status || 'Pending',
              })));
            }
          });
      }, 500);
    } catch (error) {
      setErr("Failed to submit complaint");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded shadow-md mt-6">
      <h2 className="text-xl font-semibold mb-3">Complaint / Service Request</h2>

      <form onSubmit={handleSubmit} className="mb-4 space-y-3">
        <input
          type="text"
          name="subject"
          placeholder="Subject"
          className="w-full border p-2 rounded"
          value={formData.subject}
          onChange={handleChange}
          disabled={loading}
        />
        <textarea
          name="description"
          placeholder="Description"
          rows="3"
          className="w-full border p-2 rounded"
          value={formData.description}
          onChange={handleChange}
          disabled={loading}
        ></textarea>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded" disabled={loading}>
          {loading ? "Submitting..." : "Submit Complaint"}
        </button>
        {err && <p className="text-red-500">{err}</p>}
      </form>

      <div>
        <h3 className="font-medium mb-2">Complaint History</h3>
        {loading ? (
          <p>Loading...</p>
        ) : complaints.length === 0 ? (
          <p>No complaints submitted yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {complaints.map((comp) => (
              <li key={comp.id} className="border p-2 rounded">
                <p><strong>{comp.date}</strong> - {comp.subject}</p>
                <p>{comp.description}</p>
                <p className="text-blue-600">Status: {comp.status}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ComplaintsModule;