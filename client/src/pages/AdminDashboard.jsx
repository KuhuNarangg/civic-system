import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import StatusBadge from '../components/StatusBadge';
import StatusTimeline from '../components/StatusTimeline';
import AdminCharts from '../components/AdminCharts';

const STATUS_OPTIONS = ['pending', 'in_review', 'in_progress', 'resolved', 'rejected'];

const STATUS_LABEL = {
  pending: 'Pending',
  in_review: 'In Review',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected'
};

const CATEGORY_LABEL = {
  pothole: 'Pothole',
  garbage: 'Garbage',
  water_leak: 'Water Leak',
  streetlight: 'Streetlight',
  other: 'Other'
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'severity', label: 'Highest severity' },
  { value: 'upvotes', label: 'Most upvotes' }
];

const formatDateShort = (date) => {
  try {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return '';
  }
};

const AdminDashboard = () => {
  // Data
  const [stats, setStats] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    dateFrom: '',
    dateTo: '',
    search: '',
    sort: 'newest',
    page: 1,
    limit: 10
  });
  const [searchInput, setSearchInput] = useState('');

  // UI state
  const [expandedId, setExpandedId] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [toast, setToast] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, message, onConfirm }
  const [pendingChanges, setPendingChanges] = useState({}); // { complaintId: { status, note } }
  const [updatingId, setUpdatingId] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(''), 3500);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      Object.keys(params).forEach((k) => {
        if (params[k] === 'all' || params[k] === '') delete params[k];
      });
      const [statsRes, listRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/complaints', { params })
      ]);
      setStats(statsRes.data);
      setComplaints(listRes.data.complaints || []);
      setPagination({
        total: listRes.data.total || 0,
        page: listRes.data.page || 1,
        pages: listRes.data.pages || 1
      });
    } catch (err) {
      console.error('Admin fetch error:', err);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput, page: 1 }));
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const setRowChange = (id, key, value) => {
    setPendingChanges((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [key]: value }
    }));
  };

  const handleStatusUpdate = (complaint) => {
    const change = pendingChanges[complaint._id] || {};
    const newStatus = change.status || complaint.status;
    const note = (change.note || '').trim();

    if (newStatus === complaint.status && !note) {
      return showToast('No changes to update', 'error');
    }
    if (newStatus === 'rejected' && !note) {
      return showToast('Rejection reason is required', 'error');
    }

    const reporterName = complaint.reportedBy?.name || 'the citizen';

    // Confirmation dialog
    setConfirmDialog({
      title: `Change status to ${STATUS_LABEL[newStatus]}?`,
      message: `${reporterName} will be notified by email${
        complaint.reportedBy?.email ? ` at ${complaint.reportedBy.email}` : ''
      }.${note ? ` Note: "${note}"` : ''}`,
      tone: newStatus === 'rejected' ? 'danger' : 'primary',
      onConfirm: async () => {
        setConfirmDialog(null);
        setUpdatingId(complaint._id);
        try {
          const { data } = await api.patch(
            `/admin/complaints/${complaint._id}/status`,
            { status: newStatus, note }
          );
          // Update local state directly (no full refetch)
          setComplaints((list) =>
            list.map((c) => (c._id === data.complaint._id ? data.complaint : c))
          );
          setPendingChanges((prev) => {
            const next = { ...prev };
            delete next[complaint._id];
            return next;
          });
          showToast('Status updated. Citizen notified by email.');
          // Update stats in background
          api.get('/admin/stats').then((r) => setStats(r.data)).catch(() => {});
        } catch (err) {
          showToast(err.response?.data?.error || 'Update failed', 'error');
        } finally {
          setUpdatingId(null);
        }
      }
    });
  };

  const handleBulkUpdate = (newStatus) => {
    if (selected.size === 0) return;
    setConfirmDialog({
      title: `Update ${selected.size} complaints to ${STATUS_LABEL[newStatus]}?`,
      message: `All selected reporters will be notified by email. This cannot be undone.`,
      tone: newStatus === 'rejected' ? 'danger' : 'primary',
      onConfirm: async () => {
        setConfirmDialog(null);
        const ids = Array.from(selected);
        let success = 0;
        let failed = 0;
        for (const id of ids) {
          try {
            const note = newStatus === 'rejected' ? 'Bulk rejection by admin' : '';
            const { data } = await api.patch(
              `/admin/complaints/${id}/status`,
              { status: newStatus, note }
            );
            setComplaints((list) =>
              list.map((c) => (c._id === id ? data.complaint : c))
            );
            success++;
          } catch {
            failed++;
          }
        }
        setSelected(new Set());
        showToast(
          `Updated ${success} complaint${success === 1 ? '' : 's'}${
            failed > 0 ? `, ${failed} failed` : ''
          }`
        );
        api.get('/admin/stats').then((r) => setStats(r.data)).catch(() => {});
      }
    });
  };

  const handleExport = async () => {
    try {
      const params = { ...filters };
      Object.keys(params).forEach((k) => {
        if (params[k] === 'all' || params[k] === '') delete params[k];
      });
      delete params.page;
      delete params.limit;
      const res = await api.get('/admin/export', {
        params,
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `complaints-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('CSV downloaded');
    } catch (err) {
      showToast('Export failed', 'error');
    }
  };

  const handleUnmarkDuplicate = async (complaint) => {
    try {
      const { data } = await api.patch(
        `/admin/complaints/${complaint._id}/duplicate`,
        { parentComplaintId: null }
      );
      setComplaints((list) =>
        list.map((c) => (c._id === complaint._id ? data.complaint : c))
      );
      showToast('Removed duplicate flag');
    } catch (err) {
      showToast('Failed to update', 'error');
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === complaints.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(complaints.map((c) => c._id)));
    }
  };

  const clearFilters = () => {
    setSearchInput('');
    setFilters({
      status: 'all',
      category: 'all',
      dateFrom: '',
      dateTo: '',
      search: '',
      sort: 'newest',
      page: 1,
      limit: 10
    });
  };

  const hasActiveFilters = useMemo(() => {
    return (
      filters.status !== 'all' ||
      filters.category !== 'all' ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.search ||
      filters.sort !== 'newest'
    );
  }, [filters]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">
            Manage and resolve civic complaints across your area
          </p>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 flex items-center gap-2"
        >
          📥 Export CSV
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 right-4 z-[2000] px-4 py-3 rounded-lg shadow-xl text-sm font-medium ${
            toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* SECTION 1: Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon="📋"
          label="Total Complaints"
          value={stats?.total ?? '—'}
          tint="bg-gradient-to-br from-gray-50 to-gray-100"
        />
        <StatCard
          icon="⏳"
          label="Pending"
          value={stats?.pending ?? '—'}
          tint={
            stats && stats.pending > 20
              ? 'bg-gradient-to-br from-red-50 to-red-100 ring-2 ring-red-200'
              : 'bg-gradient-to-br from-amber-50 to-amber-100'
          }
          highlight={stats && stats.pending > 20}
        />
        <StatCard
          icon="✅"
          label="Resolved This Week"
          value={stats?.resolvedThisWeek ?? '—'}
          tint="bg-gradient-to-br from-green-50 to-emerald-100"
        />
        <StatCard
          icon="⏱️"
          label="Avg Resolution"
          value={stats?.avgResolutionDays != null ? `${stats.avgResolutionDays}d` : '—'}
          tint="bg-gradient-to-br from-blue-50 to-indigo-100"
        />
      </div>

      {/* SECTION 2: Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters({ ...filters, status: e.target.value, page: 1 })
            }
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            value={filters.category}
            onChange={(e) =>
              setFilters({ ...filters, category: e.target.value, page: 1 })
            }
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) =>
              setFilters({ ...filters, dateFrom: e.target.value, page: 1 })
            }
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
            placeholder="From"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) =>
              setFilters({ ...filters, dateTo: e.target.value, page: 1 })
            }
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
            placeholder="To"
          />
          <select
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value, page: 1 })}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search title…"
            className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
          />
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="mt-3 text-xs text-brand-600 hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-brand-900">
            {selected.size} selected
          </span>
          <span className="text-xs text-brand-700">Bulk update status:</span>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleBulkUpdate(s)}
              className="text-xs px-3 py-1 bg-white border border-brand-300 rounded hover:bg-brand-100"
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-gray-600 hover:underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      complaints.length > 0 && selected.size === complaints.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <Th>Photo</Th>
                <Th>ID</Th>
                <Th>Title</Th>
                <Th>Category</Th>
                <Th>Severity</Th>
                <Th>Reporter</Th>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && complaints.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-500">
                    No complaints match your filters.
                  </td>
                </tr>
              )}
              {complaints.map((c) => {
                const isExpanded = expandedId === c._id;
                const isHot = (c.upvotes || 0) >= 10;
                return (
                  <ComplaintRow
                    key={c._id}
                    complaint={c}
                    isExpanded={isExpanded}
                    isHot={isHot}
                    isSelected={selected.has(c._id)}
                    pendingChange={pendingChanges[c._id] || {}}
                    isUpdating={updatingId === c._id}
                    onToggleExpand={() => setExpandedId(isExpanded ? null : c._id)}
                    onToggleSelect={() => toggleSelect(c._id)}
                    onSetChange={(k, v) => setRowChange(c._id, k, v)}
                    onUpdate={() => handleStatusUpdate(c)}
                    onUnmarkDuplicate={() => handleUnmarkDuplicate(c)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                disabled={pagination.page <= 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-white"
              >
                Previous
              </button>
              <button
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                disabled={pagination.page >= pagination.pages}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-white"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 4: Charts */}
      {stats && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Analytics</h2>
          <AdminCharts byCategory={stats.byCategory} perDay={stats.perDay} />
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmDialog.title}</h3>
            <p className="text-sm text-gray-600 mb-5">{confirmDialog.message}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 text-sm text-white rounded-md font-medium ${
                  confirmDialog.tone === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-brand-600 hover:bg-brand-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value, tint, highlight }) => (
  <div className={`rounded-xl p-4 border ${tint} ${highlight ? 'border-red-300' : 'border-gray-200'}`}>
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <span className="text-xl">{icon}</span>
    </div>
    <p className={`text-3xl font-bold mt-1 ${highlight ? 'text-red-700' : 'text-gray-900'}`}>
      {value}
    </p>
  </div>
);

const Th = ({ children }) => (
  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
    {children}
  </th>
);

const Td = ({ children, className = '' }) => (
  <td className={`px-3 py-3 text-sm text-gray-700 ${className}`}>{children}</td>
);

const ComplaintRow = ({
  complaint: c,
  isExpanded,
  isHot,
  isSelected,
  pendingChange,
  isUpdating,
  onToggleExpand,
  onToggleSelect,
  onSetChange,
  onUpdate,
  onUnmarkDuplicate
}) => {
  const newStatus = pendingChange.status || c.status;
  const noteRequired = newStatus === 'rejected';
  const noteValue = pendingChange.note || '';

  return (
    <>
      <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-brand-50/30' : ''}`}>
        <Td>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
          />
        </Td>
        <Td>
          {c.imageUrl ? (
            <img
              src={c.imageUrl}
              alt=""
              className="w-12 h-12 object-cover rounded cursor-pointer"
              onClick={onToggleExpand}
            />
          ) : (
            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xl">
              📌
            </div>
          )}
        </Td>
        <Td className="font-mono text-xs">
          #{String(c._id).slice(-6).toUpperCase()}
        </Td>
        <Td>
          <button
            onClick={onToggleExpand}
            className="font-medium text-gray-900 hover:text-brand-600 text-left max-w-xs truncate"
          >
            {c.title}
          </button>
          {isHot && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
              🔥 {c.upvotes} confirmed
            </span>
          )}
          {c.isDuplicate && (
            <span className="ml-2 text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
              Duplicate
            </span>
          )}
        </Td>
        <Td>{CATEGORY_LABEL[c.category] || 'Other'}</Td>
        <Td>
          <span className="text-amber-500 tracking-tight" title={`${c.severity}/5`}>
            {'★'.repeat(c.severity)}
            <span className="text-gray-300">{'★'.repeat(5 - c.severity)}</span>
          </span>
        </Td>
        <Td>
          <div className="font-medium text-gray-900 text-xs">
            {c.reportedBy?.name || '—'}
          </div>
          {c.reportedBy?.email && (
            <a
              href={`mailto:${c.reportedBy.email}`}
              className="text-xs text-brand-600 hover:underline"
            >
              {c.reportedBy.email}
            </a>
          )}
        </Td>
        <Td className="text-xs text-gray-600 whitespace-nowrap">
          {formatDateShort(c.createdAt)}
        </Td>
        <Td>
          <StatusBadge status={c.status} />
        </Td>
        <Td>
          <button
            onClick={onToggleExpand}
            className="text-brand-600 text-xs hover:underline whitespace-nowrap"
          >
            {isExpanded ? 'Collapse' : 'Manage'}
          </button>
        </Td>
      </tr>

      {/* Expanded details */}
      {isExpanded && (
        <tr className="bg-gray-50">
          <td colSpan={10} className="px-6 py-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left: image + meta */}
              <div className="lg:col-span-1">
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt={c.title}
                    className="w-full rounded-lg border border-gray-200"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                    No image
                  </div>
                )}

                <div className="mt-4 space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">📍 Address:</span>
                    <p className="text-gray-800">{c.address || 'Unknown'}</p>
                  </div>
                  {c.location?.coordinates && (
                    <p className="text-xs text-gray-500 font-mono">
                      {c.location.coordinates[1].toFixed(6)},{' '}
                      {c.location.coordinates[0].toFixed(6)}
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-2">
                    <Link
                      to={`/complaint/${c._id}`}
                      target="_blank"
                      className="text-xs px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Open public view ↗
                    </Link>
                    <span className="text-xs text-gray-500">
                      👍 {c.upvotes || 0} upvotes
                    </span>
                  </div>
                </div>
              </div>

              {/* Middle: description + AI + timeline */}
              <div className="lg:col-span-1 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Description
                  </p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap mt-1">
                    {c.description}
                  </p>
                </div>

                {c.aiProcessed && (c.severityReason || c.priorityNote) && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-xs font-semibold text-blue-900 mb-1">
                      🤖 AI Analysis
                    </p>
                    {c.severityReason && (
                      <p className="text-xs text-blue-800">
                        <strong>Severity {c.severity}/5:</strong> {c.severityReason}
                      </p>
                    )}
                    {c.priorityNote && (
                      <p className="text-xs text-blue-800 mt-1">
                        <strong>Priority:</strong> {c.priorityNote}
                      </p>
                    )}
                  </div>
                )}

                {c.isDuplicate && c.parentComplaintId && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-3">
                    <p className="text-xs font-semibold text-amber-900 mb-1">
                      AI flagged this as a duplicate
                    </p>
                    <p className="text-xs text-amber-800 mb-2">
                      Linked to #
                      {String(c.parentComplaintId._id || c.parentComplaintId)
                        .slice(-6)
                        .toUpperCase()}
                    </p>
                    <button
                      onClick={onUnmarkDuplicate}
                      className="text-xs px-2 py-1 bg-white border border-amber-300 rounded hover:bg-amber-100"
                    >
                      Not a duplicate
                    </button>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    Timeline
                  </p>
                  <StatusTimeline history={c.statusHistory} />
                </div>
              </div>

              {/* Right: status update form */}
              <div className="lg:col-span-1">
                <div className="bg-white border border-gray-200 rounded-lg p-4 sticky top-20">
                  <p className="text-sm font-semibold text-gray-900 mb-3">
                    Update Status
                  </p>

                  <label className="text-xs text-gray-600">New status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => onSetChange('status', e.target.value)}
                    className="w-full px-3 py-2 mt-1 mb-3 border border-gray-300 rounded text-sm"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>

                  <label className="text-xs text-gray-600">
                    Note {noteRequired && <span className="text-red-600">*</span>}
                  </label>
                  <textarea
                    rows={4}
                    maxLength={500}
                    value={noteValue}
                    onChange={(e) => onSetChange('note', e.target.value)}
                    placeholder={
                      noteRequired
                        ? 'Reason for rejection (required)…'
                        : 'Describe action taken or update for the citizen…'
                    }
                    className={`w-full px-3 py-2 mt-1 border rounded text-sm ${
                      noteRequired && !noteValue.trim()
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300'
                    }`}
                  />
                  <div className="text-xs text-gray-400 text-right mt-0.5">
                    {noteValue.length}/500
                  </div>

                  <button
                    onClick={onUpdate}
                    disabled={isUpdating}
                    className="w-full mt-3 px-4 py-2 bg-brand-600 text-white rounded-md font-medium hover:bg-brand-700 disabled:opacity-50"
                  >
                    {isUpdating ? 'Updating…' : 'Update Status'}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default AdminDashboard;
