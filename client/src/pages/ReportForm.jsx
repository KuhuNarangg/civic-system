import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import MapView from '../components/MapView';
import { useGeolocation } from '../hooks/useGeolocation';
import { compressImage } from '../utils/imageCompressor';

const DRAFT_KEY = 'cr_report_draft';

const CATEGORY_OPTIONS = [
  { value: 'auto', label: 'Auto-detect (AI)' },
  { value: 'pothole', label: 'Pothole' },
  { value: 'garbage', label: 'Garbage' },
  { value: 'water_leak', label: 'Water Leak' },
  { value: 'streetlight', label: 'Streetlight' },
  { value: 'other', label: 'Other' }
];

const ReportForm = () => {
  const navigate = useNavigate();
  const { getLocation, loading: gpsLoading } = useGeolocation();

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'auto'
  });
  const [marker, setMarker] = useState(null); // { lat, lng }
  const [address, setAddress] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [draftBanner, setDraftBanner] = useState(false);
  const draftLoadedRef = useRef(false);

  // 1. Auto-fill GPS on mount + check for saved draft
  useEffect(() => {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (stored) {
      try {
        const draft = JSON.parse(stored);
        if (draft.title || draft.description) {
          setDraftBanner(true);
        }
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }

    // Get GPS location regardless
    getLocation()
      .then((pos) => {
        setMarker({ lat: pos.latitude, lng: pos.longitude });
        reverseGeocode(pos.latitude, pos.longitude);
      })
      .catch(() => {
        // Fallback default coordinates (New Delhi)
        setMarker({ lat: 28.6139, lng: 77.209 });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Auto-save draft every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (form.title || form.description) {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            ...form,
            marker,
            address,
            savedAt: Date.now()
          })
        );
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [form, marker, address]);

  const restoreDraft = () => {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (draft) {
        setForm({
          title: draft.title || '',
          description: draft.description || '',
          category: draft.category || 'auto'
        });
        if (draft.marker) setMarker(draft.marker);
        if (draft.address) setAddress(draft.address);
      }
    } catch {
      // ignore
    } finally {
      setDraftBanner(false);
    }
  };

  const dismissDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setDraftBanner(false);
    draftLoadedRef.current = true;
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      const data = await res.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
      }
    } catch (err) {
      console.error('Reverse geocode failed:', err);
    }
  };

  const handleMarkerDrag = ({ lat, lng }) => {
    setMarker({ lat, lng });
    reverseGeocode(lat, lng);
  };

  const handleUseGPS = async () => {
    try {
      const pos = await getLocation();
      setMarker({ lat: pos.latitude, lng: pos.longitude });
      reverseGeocode(pos.latitude, pos.longitude);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      return setError('Please select an image file');
    }
    try {
      const compressed = await compressImage(file, 800, 0.8);
      setImageFile(compressed);
      setImagePreview(URL.createObjectURL(compressed));
    } catch (err) {
      console.error('Compression failed:', err);
      setImageFile(file); // fallback to original
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.title.trim() || !form.description.trim()) {
      return setError('Title and description are required');
    }
    if (!marker) {
      return setError('Please select a location on the map');
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title.trim());
      formData.append('description', form.description.trim());
      formData.append('category', form.category);
      formData.append('latitude', marker.lat);
      formData.append('longitude', marker.lng);
      formData.append('address', address);
      if (imageFile) formData.append('image', imageFile);

      const { data } = await api.post('/complaints', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      localStorage.removeItem(DRAFT_KEY);
      setSuccess(data.complaint);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-500 rounded-full flex items-center justify-center text-white text-3xl">
            ✓
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Complaint Submitted!</h2>
          <p className="text-gray-700 mt-2">
            Your complaint ID is{' '}
            <span className="font-mono font-semibold">
              #{String(success._id).slice(-6).toUpperCase()}
            </span>
          </p>
          {success.aiProcessed && (
            <p className="text-sm text-gray-600 mt-2">
              AI detected this as <strong>{success.category}</strong> with severity{' '}
              <strong>{success.severity}/5</strong>.
            </p>
          )}
          {success.isDuplicate && (
            <p className="text-sm text-amber-700 mt-2">
              We detected a similar nearby complaint and linked yours to it.
            </p>
          )}
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate(`/complaint/${success._id}`)}
              className="px-5 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700"
            >
              View Complaint
            </button>
            <button
              onClick={() => {
                setSuccess(null);
                setForm({ title: '', description: '', category: 'auto' });
                setImageFile(null);
                setImagePreview(null);
              }}
              className="px-5 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Report Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Report a Civic Issue</h1>
      <p className="text-gray-500 text-sm mt-1">
        Describe the issue, mark its location and add a photo if you can.
      </p>

      {draftBanner && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded flex items-center justify-between gap-2">
          <p className="text-sm text-amber-800">
            You have an unsaved draft. Restore it?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={restoreDraft}
              className="px-3 py-1 bg-amber-600 text-white rounded text-sm"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={dismissDraft}
              className="px-3 py-1 border border-amber-300 rounded text-sm"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="e.g. Large pothole near city park"
            maxLength={200}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Describe the issue, when you noticed it, severity..."
            maxLength={2000}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Photo (optional)
          </label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageChange}
            className="block w-full text-sm text-gray-700 file:mr-3 file:px-4 file:py-2 file:rounded-md file:border-0 file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
          />
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Preview"
              className="mt-3 max-h-64 rounded-md border border-gray-200"
            />
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Location *</label>
            <button
              type="button"
              onClick={handleUseGPS}
              disabled={gpsLoading}
              className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              {gpsLoading ? 'Locating…' : '📍 Use my GPS'}
            </button>
          </div>
          <div className="rounded-md overflow-hidden border border-gray-200" style={{ height: 320 }}>
            {marker && (
              <MapView
                complaints={[]}
                center={[marker.lat, marker.lng]}
                zoom={16}
                draggableMarker={[marker.lat, marker.lng]}
                onMarkerDrag={handleMarkerDrag}
                height="100%"
              />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            <span className="font-medium">Tip:</span> drag the pin to refine location
          </p>
          {address && (
            <p className="text-sm text-gray-700 mt-1 bg-gray-50 rounded p-2">📍 {address}</p>
          )}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-2.5 bg-brand-600 text-white rounded-md font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Complaint'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReportForm;
