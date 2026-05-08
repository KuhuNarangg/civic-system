import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import StatusBadge from '../components/StatusBadge';
import StatusTimeline from '../components/StatusTimeline';
import MapView from '../components/MapView';
import { useAuth } from '../context/AuthContext';

const CATEGORY_LABEL = {
  pothole: 'Pothole',
  garbage: 'Garbage',
  water_leak: 'Water Leak',
  streetlight: 'Streetlight',
  other: 'Other'
};

const ComplaintDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [upvoting, setUpvoting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const { data } = await api.get(`/complaints/${id}`);
        if (!cancelled) setComplaint(data.complaint);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Failed to load complaint');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleUpvote = async () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    setUpvoting(true);
    try {
      const { data } = await api.patch(`/complaints/${id}/upvote`);
      setComplaint((prev) => {
        if (!prev) return prev;
        const userIdStr = user.id || user._id;
        let upvotedBy = prev.upvotedBy || [];
        if (data.upvoted) {
          upvotedBy = [...upvotedBy, userIdStr];
        } else {
          upvotedBy = upvotedBy.filter((u) => u.toString() !== userIdStr.toString());
        }
        return { ...prev, upvotes: data.upvotes, upvotedBy };
      });
    } catch (err) {
      console.error('Upvote failed:', err);
    } finally {
      setUpvoting(false);
    }
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-8 text-gray-500">Loading…</div>;
  }
  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>
      </div>
    );
  }
  if (!complaint) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-gray-500">Complaint not found.</div>
    );
  }

  const userId = user ? (user.id || user._id) : null;
  const hasUpvoted = userId
    ? (complaint.upvotedBy || []).some((u) => u.toString() === userId.toString())
    : false;

  const [lng, lat] = complaint.location?.coordinates || [0, 0];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/" className="text-sm text-brand-600 hover:underline">
        ← Back to map
      </Link>

      {/* Image */}
      {complaint.imageUrl ? (
        <img
          src={complaint.imageUrl}
          alt={complaint.title}
          className="w-full max-h-96 object-cover rounded-lg mt-4 border border-gray-200"
        />
      ) : (
        <div className="w-full h-48 bg-gray-100 rounded-lg mt-4 flex items-center justify-center text-gray-400">
          No image provided
        </div>
      )}

      {/* Header */}
      <div className="mt-5">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <StatusBadge status={complaint.status} />
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
            {CATEGORY_LABEL[complaint.category] || 'Other'}
          </span>
          <span className="text-xs text-gray-500">
            #{String(complaint._id).slice(-6).toUpperCase()}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{complaint.title}</h1>

        {/* Severity */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm text-gray-600">Severity:</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={n <= complaint.severity ? 'text-amber-500' : 'text-gray-300'}
              >
                ★
              </span>
            ))}
          </div>
          <span className="text-sm text-gray-600">({complaint.severity}/5)</span>
        </div>

        {complaint.reportedBy && (
          <p className="text-sm text-gray-500 mt-2">
            Reported by{' '}
            <span className="font-medium text-gray-700">{complaint.reportedBy.name}</span> on{' '}
            {new Date(complaint.createdAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Duplicate banner */}
      {complaint.isDuplicate && complaint.parentComplaintId && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
          This appears to be a duplicate of complaint{' '}
          <Link
            to={`/complaint/${complaint.parentComplaintId._id || complaint.parentComplaintId}`}
            className="underline font-medium"
          >
            #
            {String(
              complaint.parentComplaintId._id || complaint.parentComplaintId
            )
              .slice(-6)
              .toUpperCase()}
          </Link>
          . Both complaints have been linked.
        </div>
      )}

      {/* AI note */}
      {complaint.aiProcessed && (complaint.severityReason || complaint.priorityNote) && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
          <div className="font-medium text-blue-900 mb-1">🤖 AI Analysis</div>
          {complaint.severityReason && (
            <p className="text-blue-800">
              <strong>Severity:</strong> {complaint.severityReason}
            </p>
          )}
          {complaint.priorityNote && (
            <p className="text-blue-800 mt-1">
              <strong>Priority note:</strong> {complaint.priorityNote}
            </p>
          )}
        </div>
      )}

      {/* Description */}
      <div className="mt-6">
        <h2 className="font-semibold text-gray-900 mb-2">Description</h2>
        <p className="text-gray-700 whitespace-pre-wrap">{complaint.description}</p>
      </div>

      {/* Location */}
      {lat && lng ? (
        <div className="mt-6">
          <h2 className="font-semibold text-gray-900 mb-2">Location</h2>
          {complaint.address && (
            <p className="text-sm text-gray-600 mb-2">📍 {complaint.address}</p>
          )}
          <div
            className="rounded-md overflow-hidden border border-gray-200"
            style={{ height: 280 }}
          >
            <MapView
              complaints={[complaint]}
              center={[lat, lng]}
              zoom={17}
              height="100%"
            />
          </div>
        </div>
      ) : null}

      {/* Upvote */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleUpvote}
          disabled={upvoting}
          className={`px-4 py-2 rounded-md border font-medium flex items-center gap-2 transition ${
            hasUpvoted
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          } disabled:opacity-50`}
        >
          <span>👍</span>
          <span>{hasUpvoted ? 'Upvoted' : 'Upvote'}</span>
          <span className="font-bold">{complaint.upvotes || 0}</span>
        </button>
        <p className="text-xs text-gray-500">Higher upvotes = higher priority</p>
      </div>

      {/* Status Timeline */}
      <div className="mt-8">
        <h2 className="font-semibold text-gray-900 mb-4">Status Timeline</h2>
        <StatusTimeline history={complaint.statusHistory} />
      </div>
    </div>
  );
};

export default ComplaintDetail;
