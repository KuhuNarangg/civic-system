import { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import StatusBadge from '../components/StatusBadge';

const STATUS_OPTIONS = [
  'pending',
  'in_review',
  'in_progress',
  'resolved',
  'rejected'
];

const CATEGORY_LABEL = {
  pothole: 'Pothole',
  garbage: 'Garbage',
  water_leak: 'Water Leak',
  streetlight: 'Streetlight',
  other: 'Other'
};

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [filters, setFilters] = useState({ status: 'all', category: 'all' });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [updating, setUpdating] = useState({}); // { complaintId: bool }
  const [pendingChanges, setPendingChanges] = useState({}); // local changes per row

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.category !== 'all') params.category = filters.category;
      const [statsRes, listRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/complaints', { params })
      ]);
      setStats(statsRes.data);
      setComplaints(listRes.data.complaints || []);
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const setRowChange = (id, key, value) => {
    setPendingChanges((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [key]: value }
    }));
  };

  const handleStatusUpdate = async (complaint) => {
    const change = pendingChanges[complaint._id] || {};
    const newStatus = change.status || complaint.status;
    const note = change.note || '';

    if (newStatus === complaint.status && !note) {
      return showToast('No changes to update');
    }

    setUpdating((u) => ({ ...u, [complaint._id]: true }));
    try {
      await api.patch(`/admin/complaints/${complaint._id}/status`, {
        status: newStatus,
        note
      });
      showToast('Status updated successfully');
      // Clear pending change for this row
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[complaint._id];
        return next;
      });
      fetchAll();
    } catch (err) {
      showToast(err.response?.data?.error || 'Update failed');
    } finally {
      setUpdating((u) => ({ ...u, [complaint._id]: false }));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      <p className="text-sm text-gray-500">Manage and resolve civic complaints</p>

      {toast && (
        <div className="fixed top-20 right-4 z-[2000] bg-gray-900 text-white px-4 py-2 rounded shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <StatCard
          label="Total Complaints"
          value={stats?.total ?? '—'}
          color="bg-gray-100 text-gray-900"
        />
        <StatCard
          label="Pending"
          value={stats?.byStatus?.pending ?? '—'}
          color="bg-red-50 text-red-700"
        />
        <StatCard
          label="Resolved"
          value={stats?.byStatus?.resolved ?? '—'}
          color="bg-green-50 text-green-700"
        />
        <StatCard
          label="Avg Resolution"
          value={stats?.avgResolutionHours != null ? `${stats.avgResolutionHours}h` : '—'}
          color="bg-blue-50 text-blue-700"
        />
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-3 items-center">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value="all">All Categories</option>
          {Object.keys(CATEGORY_LABEL).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      {/* Complaints table */}
      <div className="mt-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>ID</Th>
                <Th>Title</Th>
                <Th>Category</Th>
                <Th>Severity</Th>
                <Th>Status</Th>
                <Th>Reporter</Th>
                <Th>Date</Th>
                <Th>Update</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && complaints.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    No complaints found
                  </td>
                </tr>
              )}
              {complaints.map((c) => {
                const pending = pendingChanges[c._id] || {};
                return (
                  <tr key={c._id} className="hover:bg-gray-50 align-top">
                    <Td>
                      <a
                        href={`/complaint/${c._id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:underline font-mono text-xs"
                      >
                        #{String(c._id).slice(-6).toUpperCase()}
                      </a>
                    </Td>
                    <Td>
                      <div className="font-medium text-gray-900 max-w-xs truncate">
                        {c.title}
                      </div>
                    </Td>
                    <Td>{CATEGORY_LABEL[c.category] || 'Other'}</Td>
                    <Td>
                      <span className="text-amber-600">
                        {'★'.repeat(c.severity)}
                        <span className="text-gray-300">
                          {'★'.repeat(5 - c.severity)}
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge status={c.status} />
                    </Td>
                    <Td>
                      <div className="text-sm text-gray-700">
                        {c.reportedBy?.name || '—'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {c.reportedBy?.email || ''}
                      </div>
                    </Td>
                    <Td>
                      <div className="text-xs text-gray-600">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1 min-w-[200px]">
                        <select
                          value={pending.status || c.status}
                          onChange={(e) =>
                            setRowChange(c._id, 'status', e.target.value)
                          }
                          className="text-xs px-2 py-1 border border-gray-300 rounded"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s.replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Note (optional)"
                          value={pending.note || ''}
                          onChange={(e) =>
                            setRowChange(c._id, 'note', e.target.value)
                          }
                          className="text-xs px-2 py-1 border border-gray-300 rounded"
                        />
                        <button
                          onClick={() => handleStatusUpdate(c)}
                          disabled={!!updating[c._id]}
                          className="text-xs px-2 py-1 bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50"
                        >
                          {updating[c._id] ? 'Saving…' : 'Update'}
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color }) => (
  <div className={`rounded-lg p-4 ${color}`}>
    <p className="text-sm font-medium opacity-80">{label}</p>
    <p className="text-2xl font-bold mt-1">{value}</p>
  </div>
);

const Th = ({ children }) => (
  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
    {children}
  </th>
);

const Td = ({ children }) => (
  <td className="px-3 py-3 text-sm text-gray-700">{children}</td>
);

export default AdminDashboard;
