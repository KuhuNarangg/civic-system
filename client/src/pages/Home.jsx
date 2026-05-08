import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import MapView from '../components/MapView';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'pothole', label: 'Pothole' },
  { value: 'garbage', label: 'Garbage' },
  { value: 'water_leak', label: 'Water Leak' },
  { value: 'streetlight', label: 'Streetlight' },
  { value: 'other', label: 'Other' }
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_review', label: 'In Review' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' }
];

const CATEGORY_META = {
  pothole: { emoji: '🕳️', label: 'Potholes', color: 'bg-orange-100 text-orange-700' },
  garbage: { emoji: '🗑️', label: 'Garbage', color: 'bg-emerald-100 text-emerald-700' },
  water_leak: { emoji: '💧', label: 'Water Leaks', color: 'bg-cyan-100 text-cyan-700' },
  streetlight: { emoji: '💡', label: 'Streetlights', color: 'bg-amber-100 text-amber-700' },
  other: { emoji: '📌', label: 'Other Issues', color: 'bg-purple-100 text-purple-700' }
};

const formatDate = (date) => {
  try {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '';
  }
};

const Home = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [filters, setFilters] = useState({ category: 'all', status: 'all' });
  const [loading, setLoading] = useState(true);
  const [center, setCenter] = useState([28.6139, 77.209]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
        () => {}
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchComplaints = async () => {
      setLoading(true);
      try {
        const params = {};
        if (filters.category !== 'all') params.category = filters.category;
        if (filters.status !== 'all') params.status = filters.status;
        const { data } = await api.get('/complaints', { params });
        if (!cancelled) setComplaints(data.complaints || []);
      } catch (err) {
        console.error('Failed to fetch complaints:', err);
        if (!cancelled) setComplaints([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchComplaints();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const stats = useMemo(() => {
    const total = complaints.length;
    const resolved = complaints.filter((c) => c.status === 'resolved').length;
    const inProgress = complaints.filter((c) => c.status === 'in_progress').length;
    const pending = complaints.filter((c) => c.status === 'pending').length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, resolved, inProgress, pending, resolutionRate };
  }, [complaints]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    Object.keys(CATEGORY_META).forEach((k) => (counts[k] = 0));
    complaints.forEach((c) => {
      if (counts[c.category] !== undefined) counts[c.category]++;
    });
    return counts;
  }, [complaints]);

  const recentComplaints = useMemo(() => complaints.slice(0, 4), [complaints]);

  return (
    <div className="flex-1">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-blue-900 text-white">
        <div className="absolute inset-0 opacity-20" aria-hidden="true">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full mix-blend-overlay blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-300 rounded-full mix-blend-overlay blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-1 rounded-full text-xs font-medium border border-white/20 mb-4">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Live citizen reporting
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                Make your city <span className="text-cyan-300">better</span>,
                <br />
                one report at a time.
              </h1>
              <p className="mt-5 text-lg text-blue-100 max-w-xl">
                Spot a pothole, broken streetlight, or garbage pile? Report it in 30 seconds.
                Our AI categorizes it, the city sees it, and you track every step until it's fixed.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to={user ? '/report' : '/register'}
                  className="px-6 py-3 bg-white text-brand-700 rounded-lg font-semibold hover:bg-blue-50 shadow-lg shadow-black/10 transition flex items-center gap-2"
                >
                  <span className="text-xl leading-none">+</span>
                  Report an Issue
                </Link>
                <a
                  href="#live-map"
                  className="px-6 py-3 bg-white/10 backdrop-blur text-white rounded-lg font-semibold hover:bg-white/20 border border-white/30 transition flex items-center gap-2"
                >
                  Explore the Map →
                </a>
              </div>

              <div className="mt-8 flex items-center gap-6 text-sm text-blue-100">
                <span className="flex items-center gap-1.5">
                  <span>🤖</span> AI-powered triage
                </span>
                <span className="flex items-center gap-1.5">
                  <span>📍</span> GPS-tagged reports
                </span>
                <span className="flex items-center gap-1.5">
                  <span>🔔</span> Email updates
                </span>
              </div>
            </div>

            {/* Hero stats card */}
            <div className="relative">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 shadow-2xl">
                <p className="text-sm text-blue-100 mb-4">Community impact, live</p>
                <div className="grid grid-cols-2 gap-4">
                  <HeroStat label="Total Reports" value={stats.total} icon="📋" />
                  <HeroStat label="Resolved" value={stats.resolved} icon="✅" />
                  <HeroStat label="In Progress" value={stats.inProgress} icon="🔧" />
                  <HeroStat
                    label="Resolution Rate"
                    value={`${stats.resolutionRate}%`}
                    icon="📈"
                  />
                </div>
                <div className="mt-5 pt-5 border-t border-white/20">
                  <div className="flex justify-between text-xs text-blue-100 mb-1">
                    <span>Resolution Progress</span>
                    <span>{stats.resolutionRate}%</span>
                  </div>
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-300 to-green-400 rounded-full transition-all duration-700"
                      style={{ width: `${stats.resolutionRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider">
              How it works
            </p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-gray-900">
              From report to resolution in three steps
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Step
              number="1"
              title="Snap & Report"
              icon="📷"
              description="Take a photo, drop a pin on the map, write a short description. We auto-fill your location."
            />
            <Step
              number="2"
              title="AI Triages"
              icon="🤖"
              description="Gemini AI categorizes the issue, scores severity 1–5, and flags duplicates within 100 m."
            />
            <Step
              number="3"
              title="Track in real time"
              icon="📊"
              description="Get email updates as admins move it through Pending → In Progress → Resolved."
            />
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="py-16 bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Report any civic issue
            </h2>
            <p className="text-gray-600 mt-2">
              Our system handles the most common urban problems
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(CATEGORY_META).map(([key, meta]) => (
              <button
                key={key}
                onClick={() =>
                  setFilters({ category: key, status: 'all' })
                }
                className={`group rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md hover:-translate-y-0.5 transition text-left ${
                  filters.category === key ? 'ring-2 ring-brand-500' : ''
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl mb-3 ${meta.color}`}
                >
                  {meta.emoji}
                </div>
                <p className="font-semibold text-gray-900">{meta.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {categoryCounts[key] || 0} reports
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* LIVE MAP */}
      <section id="live-map" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider">
                Live map
              </p>
              <h2 className="mt-1 text-3xl font-bold text-gray-900">
                Issues happening near you
              </h2>
            </div>
            <div className="flex flex-wrap gap-2 items-center text-xs text-gray-600">
              <Legend color="#ef4444" label="Pending" />
              <Legend color="#3b82f6" label="In Review" />
              <Legend color="#f59e0b" label="In Progress" />
              <Legend color="#10b981" label="Resolved" />
            </div>
          </div>

          {/* Filter bar */}
          <div className="bg-gray-50 border border-gray-200 rounded-t-xl px-4 py-3 flex flex-wrap items-center gap-3">
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-500">
              {loading ? 'Loading…' : `${complaints.length} issue${complaints.length === 1 ? '' : 's'}`}
            </span>
            {(filters.category !== 'all' || filters.status !== 'all') && (
              <button
                onClick={() => setFilters({ category: 'all', status: 'all' })}
                className="ml-auto text-xs text-brand-600 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Map */}
          <div
            className="relative border-x border-b border-gray-200 rounded-b-xl overflow-hidden"
            style={{ height: 520 }}
          >
            <MapView complaints={complaints} center={center} zoom={13} height="100%" />

            {/* Floating CTA */}
            <Link
              to={user ? '/report' : '/register'}
              className="absolute bottom-5 right-5 z-[500] bg-brand-600 text-white px-5 py-3 rounded-full shadow-xl hover:bg-brand-700 font-medium flex items-center gap-2"
            >
              <span className="text-xl leading-none">+</span>
              Report an Issue
            </Link>

            {complaints.length === 0 && !loading && (
              <div className="absolute inset-0 z-[400] flex items-center justify-center pointer-events-none">
                <div className="bg-white/95 backdrop-blur rounded-xl shadow-lg px-6 py-4 border border-gray-200 pointer-events-auto text-center max-w-sm">
                  <p className="text-gray-700 font-medium">No issues match your filters</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Be the first to report — your community will thank you.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* RECENT REPORTS */}
      {recentComplaints.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider">
                  Recent
                </p>
                <h2 className="mt-1 text-3xl font-bold text-gray-900">Latest reports</h2>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recentComplaints.map((c) => (
                <Link
                  key={c._id}
                  to={`/complaint/${c._id}`}
                  className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition"
                >
                  {c.imageUrl ? (
                    <img
                      src={c.imageUrl}
                      alt={c.title}
                      className="w-full h-36 object-cover group-hover:scale-105 transition duration-500"
                    />
                  ) : (
                    <div className="w-full h-36 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-4xl">
                      {CATEGORY_META[c.category]?.emoji || '📌'}
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          CATEGORY_META[c.category]?.color || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {CATEGORY_META[c.category]?.label || 'Other'}
                      </span>
                      <StatusBadge status={c.status} />
                    </div>
                    <h3 className="font-semibold text-gray-900 line-clamp-2">{c.title}</h3>
                    <p className="text-xs text-gray-500 mt-2">{formatDate(c.createdAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-brand-700 to-blue-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold">
            See something? Report it.
          </h2>
          <p className="mt-3 text-blue-100 text-lg">
            Every report makes your neighborhood a little better. Takes less than a minute.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to={user ? '/report' : '/register'}
              className="px-6 py-3 bg-white text-brand-700 rounded-lg font-semibold hover:bg-blue-50 shadow-lg transition"
            >
              {user ? 'Report an Issue' : 'Get Started Free'}
            </Link>
            {!user && (
              <Link
                to="/login"
                className="px-6 py-3 bg-white/10 backdrop-blur text-white rounded-lg font-semibold hover:bg-white/20 border border-white/30 transition"
              >
                I have an account
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-sm">
              C
            </div>
            <span className="font-semibold text-white">Civic Reporter</span>
          </div>
          <p className="text-sm">
            Built with React, Express, MongoDB & Gemini AI · © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

const HeroStat = ({ label, value, icon }) => (
  <div className="bg-white/10 rounded-lg p-3 border border-white/10">
    <div className="flex items-center gap-2 text-xs text-blue-100">
      <span>{icon}</span>
      <span>{label}</span>
    </div>
    <p className="text-2xl font-bold mt-1">{value}</p>
  </div>
);

const Step = ({ number, title, icon, description }) => (
  <div className="relative bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-brand-200 transition">
    <div className="absolute -top-3 -left-3 w-9 h-9 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center shadow-md">
      {number}
    </div>
    <div className="text-4xl mb-3">{icon}</div>
    <h3 className="font-semibold text-lg text-gray-900">{title}</h3>
    <p className="text-sm text-gray-600 mt-2">{description}</p>
  </div>
);

const Legend = ({ color, label }) => (
  <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded">
    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
    {label}
  </div>
);

export default Home;
