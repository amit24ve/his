// src/components/crm/CommunicationLog.jsx
import React, { useState } from 'react';

const CommunicationLog = () => {
  const [logs, setLogs] = useState([]);
  const [formData, setFormData] = useState({
    type: 'WhatsApp',
    message: '',
    contactPerson: '',
  });

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.message || !formData.contactPerson) return;

    const newLog = {
      ...formData,
      id: Date.now(),
      time: new Date().toLocaleString(),
    };

    setLogs([newLog, ...logs]);
    setFormData({
      type: 'WhatsApp',
      message: '',
      contactPerson: '',
    });
  };

  return (
    <div className="p-4 bg-white rounded shadow-md mt-6">
      <h2 className="text-xl font-semibold mb-3">Communication Log</h2>

      <form onSubmit={handleSubmit} className="mb-4 space-y-3">
        <div className="flex gap-4">
          <select
            name="type"
            className="border p-2 rounded w-1/3"
            value={formData.type}
            onChange={handleChange}
          >
            <option value="WhatsApp">WhatsApp</option>
            <option value="Email">Email</option>
            <option value="Call">Call</option>
          </select>

          <input
            type="text"
            name="contactPerson"
            placeholder="Contact Person"
            className="border p-2 rounded w-2/3"
            value={formData.contactPerson}
            onChange={handleChange}
          />
        </div>

        <textarea
          name="message"
          placeholder="Message or Call Summary"
          rows="3"
          className="w-full border p-2 rounded"
          value={formData.message}
          onChange={handleChange}
        ></textarea>

        <button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded">
          Log Communication
        </button>
      </form>

      <div>
        <h3 className="font-medium mb-2">Recent Logs</h3>
        {logs.length === 0 ? (
          <p>No communications logged yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {logs.map((log) => (
              <li key={log.id} className="border p-2 rounded">
                <p><strong>{log.time}</strong> — <span className="text-indigo-600">{log.type}</span></p>
                <p><strong>To:</strong> {log.contactPerson}</p>
                <p>{log.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CommunicationLog;
