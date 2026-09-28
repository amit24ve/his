// src/components/crm/LoyaltyPoints.jsx
import React, { useState } from 'react';

const LoyaltyPoints = () => {
  const [points, setPoints] = useState(0);
  const [history, setHistory] = useState([]);
  const [amount, setAmount] = useState('');

  const handleAddPoints = (type) => {
    const value = parseInt(amount);
    if (isNaN(value) || value <= 0) return;

    const updatedPoints = type === 'add' ? points + value : Math.max(points - value, 0);
    const entry = {
      id: Date.now(),
      type,
      value,
      time: new Date().toLocaleString(),
    };

    setPoints(updatedPoints);
    setHistory([entry, ...history]);
    setAmount('');
  };

  return (
    <div className="p-4 bg-white rounded shadow-md mt-6">
      <h2 className="text-xl font-semibold mb-3">Loyalty Points</h2>

      <div className="mb-4">
        <p className="text-lg font-medium">Current Points: <span className="text-green-600">{points}</span></p>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="border p-2 rounded w-1/3"
          placeholder="Enter points"
        />
        <button onClick={() => handleAddPoints('add')} className="bg-blue-600 text-white px-4 py-2 rounded">
          Add
        </button>
        <button onClick={() => handleAddPoints('deduct')} className="bg-red-600 text-white px-4 py-2 rounded">
          Deduct
        </button>
      </div>

      <div>
        <h3 className="font-medium mb-2">Points History</h3>
        {history.length === 0 ? (
          <p>No points activity yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((item) => (
              <li key={item.id} className="border p-2 rounded">
                <p>
                  <strong>{item.time}</strong> —{' '}
                  {item.type === 'add' ? (
                    <span className="text-green-600">+{item.value} added</span>
                  ) : (
                    <span className="text-red-600">-{item.value} deducted</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default LoyaltyPoints;
