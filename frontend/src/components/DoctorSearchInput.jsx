import React, { useState, useRef, useEffect } from 'react';
import { useCurrentUser } from '../hooks/useCurrentUser';

const API_BASE = 'https://cubehis.avopay.pro:5000';

/**
 * Reusable doctor search + dropdown input.
 *
 * Props:
 *   value        {string}   - controlled value (doctor name string)
 *   onChange     {fn}       - called with (name, doctorObj) when user types or picks
 *   onSelect     {fn?}      - called with full doctor object when picked from dropdown
 *   placeholder  {string?}
 *   required     {boolean?}
 *   className    {string?}  - extra classes for the outer wrapper div
 *   inputClass   {string?}  - extra classes for the <input>
 */
export default function DoctorSearchInput({
  value = '',
  onChange,
  onSelect,
  placeholder = 'Search doctor by name…',
  required = false,
  className = '',
  inputClass = '',
}) {
  const { hospital_id, headers } = useCurrentUser();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef();
  const wrapRef = useRef();

  // Sync external value changes (e.g. when form is pre-filled)
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowDrop(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchDoctors = async (q) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (hospital_id) params.set('hospital_id', hospital_id);
      if (q) params.set('search', q);
      const res = await fetch(`${API_BASE}/api/users/doctors?${params}`, { headers });
      const data = await res.json();
      setResults(Array.isArray(data.doctors) ? data.doctors : []);
      setShowDrop(true);
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (onChange) onChange(val, null);
    clearTimeout(timerRef.current);
    if (val.length === 0) {
      setResults([]);
      setShowDrop(false);
      return;
    }
    timerRef.current = setTimeout(() => fetchDoctors(val), 280);
  };

  const handleFocus = () => {
    if (results.length > 0) {
      setShowDrop(true);
    } else if (query.length === 0) {
      // Load all doctors for this hospital on first focus
      fetchDoctors('');
    }
  };

  const handleSelect = (doc) => {
    setQuery(doc.name);
    setShowDrop(false);
    if (onChange) onChange(doc.name, doc);
    if (onSelect) onSelect(doc);
  };

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <div className="relative">
        <input
          type="text"
          required={required}
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 pr-7 ${inputClass}`}
        />
        {loading
          ? <i className="fas fa-spinner fa-spin absolute right-2.5 top-2.5 text-blue-400 text-xs pointer-events-none" />
          : <i className="fas fa-user-md absolute right-2.5 top-2.5 text-gray-300 text-xs pointer-events-none" />
        }
      </div>

      {showDrop && (
        <div className="absolute z-50 left-0 right-0 bg-white border border-blue-200 rounded-xl shadow-xl mt-1 max-h-56 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-xs text-gray-400 text-center">
              {loading ? 'Searching…' : 'No doctors found'}
            </div>
          ) : (
            <>
              <div className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 border-b sticky top-0">
                <i className="fas fa-user-md mr-1" /> Select Doctor
              </div>
              {results.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onMouseDown={() => handleSelect(doc)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 text-left transition border-b last:border-0"
                >
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-user-md text-indigo-500 text-xs" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">{doc.name}</div>
                    {doc.department && (
                      <div className="text-xs text-gray-400 truncate">{doc.department}</div>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
