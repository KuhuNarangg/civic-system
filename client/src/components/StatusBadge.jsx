const STYLES = {
  pending: 'bg-gray-100 text-gray-700 border-gray-300',
  in_review: 'bg-blue-100 text-blue-700 border-blue-300',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-300',
  resolved: 'bg-green-100 text-green-700 border-green-300',
  rejected: 'bg-red-100 text-red-700 border-red-300'
};

const LABELS = {
  pending: 'Pending',
  in_review: 'In Review',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected'
};

const StatusBadge = ({ status, className = '' }) => {
  const style = STYLES[status] || STYLES.pending;
  const label = LABELS[status] || status;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style} ${className}`}
    >
      {label}
    </span>
  );
};

export default StatusBadge;
