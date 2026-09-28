// src/components/crm/FeedbackSystem.jsx
import React, { useState } from 'react';

const FeedbackSystem = () => {
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackText, setFeedbackText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;

    const newFeedback = {
      text: feedbackText,
      date: new Date().toLocaleDateString(),
    };

    setFeedbackList([newFeedback, ...feedbackList]);
    setFeedbackText('');
  };

  return (
    <div className="p-4 bg-white rounded shadow-md mt-6">
      <h2 className="text-xl font-semibold mb-3">Feedback System</h2>
      
      <form onSubmit={handleSubmit} className="mb-4">
        <textarea
          className="w-full border p-2 rounded mb-2"
          rows="3"
          placeholder="Write your feedback..."
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Submit Feedback
        </button>
      </form>

      <div>
        <h3 className="font-medium mb-2">Previous Feedback</h3>
        {feedbackList.length === 0 ? (
          <p>No feedback submitted yet.</p>
        ) : (
          <ul className="space-y-2">
            {feedbackList.map((fb, index) => (
              <li key={index} className="border p-2 rounded text-sm">
                <strong>{fb.date}:</strong> {fb.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FeedbackSystem;
