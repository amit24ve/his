import React, { useEffect, useState } from "react";

const MeetingsWidget = () => {
  const [meetings, setMeetings] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    name: "",
    location: "",
    time: "",
    date: new Date().toISOString().slice(0, 10),
    status: "Confirmed",
    purpose: "",
    duration: "",
    contact: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/meetings?date=${form.date}`)
      .then((r) => r.json())
      .then(setMeetings);
  }, [form.date, showForm]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/meetings/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) {
      setShowForm(false);
      setForm({
        title: "",
        name: "",
        location: "",
        time: "",
        date: new Date().toISOString().slice(0, 10),
        status: "Confirmed",
        purpose: "",
        duration: "",
        contact: "",
        notes: "",
      });
      const data = await res.json();
      setMeetings((m) => [...m, data]);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-bold">Today's Meetings</h2>
        <button
          onClick={() => setShowForm((f) => !f)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {showForm ? "Cancel" : "Add Meeting"}
        </button>
      </div>
      {showForm && (
        <form className="bg-white p-4 rounded shadow mb-4" onSubmit={handleSubmit}>
          <div className="mb-2">
            <label className="block mb-1">Title</label>
            <input name="title" className="border p-2 w-full" required value={form.title} onChange={handleChange} />
          </div>
          <div className="mb-2">
            <label className="block mb-1">Name</label>
            <input name="name" className="border p-2 w-full" required value={form.name} onChange={handleChange} />
          </div>
          <div className="mb-2">
            <label className="block mb-1">Location</label>
            <input name="location" className="border p-2 w-full" required value={form.location} onChange={handleChange} />
          </div>
          <div className="mb-2">
            <label className="block mb-1">Time</label>
            <input name="time" className="border p-2 w-full" required value={form.time} onChange={handleChange} />
          </div>
          <div className="mb-2">
            <label className="block mb-1">Date</label>
            <input name="date" type="date" className="border p-2 w-full" required value={form.date} onChange={handleChange} />
          </div>
          {/* ...add more fields as needed... */}
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded" disabled={loading}>
            {loading ? "Adding..." : "Add Meeting"}
          </button>
        </form>
      )}
      <ul className="divide-y">
        {meetings.map((m) => (
          <li key={m.id} className="p-3">
            <b>{m.time}</b> - {m.name} @ {m.location}
            {m.google_meet_link && (
              <a href={m.google_meet_link} target="_blank" rel="noopener noreferrer" className="ml-4 text-blue-600 underline">
                Google Meet
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
);
};

export default MeetingsWidget;