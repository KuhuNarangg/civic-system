import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import ComplaintCard from '../components/ComplaintCard';

const MyComplaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const { data } = await api.get('/complaints/my');
        if (!cancelled) setComplaints(data.complaints || []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Complaints</h1>
          <p className="text-sm text-gray-500">All issues you've reported</p>
        </div>
        <Link
          to="/report"
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-medium hover:bg-brand-700"
        >
          + New Report
        </Link>
      </div>

      {loading && <p className="text-gray-500">Loading…</p>}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {!loading && !error && complaints.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
          <div className="text-5xl mb-3">📭</div>
          <h2 className="text-lg font-semibold text-gray-900">
            You haven't reported any issues yet
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Help your community by reporting civic problems you spot.
          </p>
          <Link
            to="/report"
            className="inline-block mt-4 px-5 py-2 bg-brand-600 text-white rounded-md font-medium hover:bg-brand-700"
          >
            Report an Issue
          </Link>
        </div>
      )}

      {complaints.length > 0 && (
        <div className="space-y-3">
          {complaints.map((c) => (
            <ComplaintCard key={c._id} complaint={c} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyComplaints;
