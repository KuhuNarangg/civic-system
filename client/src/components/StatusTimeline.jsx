import StatusBadge from './StatusBadge';

const formatDate = (date) => {
  try {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).replace(',', ' at');
  } catch {
    return '';
  }
};

const StatusTimeline = ({ history = [] }) => {
  if (!history || history.length === 0) {
    return <p className="text-gray-500 text-sm">No status changes yet.</p>;
  }

  // Show newest first
  const sorted = [...history].sort(
    (a, b) => new Date(b.changedAt) - new Date(a.changedAt)
  );

  return (
    <ol className="relative border-l-2 border-gray-200 ml-3 space-y-6">
      {sorted.map((entry, idx) => (
        <li key={idx} className="ml-6">
          <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 ring-4 ring-white" />
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <StatusBadge status={entry.status} />
            <time className="text-xs text-gray-500">{formatDate(entry.changedAt)}</time>
          </div>
          {entry.note && (
            <p className="text-sm text-gray-700 bg-gray-50 rounded-md p-2 mt-1">
              {entry.note}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
};

export default StatusTimeline;
