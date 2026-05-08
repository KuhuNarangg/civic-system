import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';

const CATEGORY_LABEL = {
  pothole: 'Pothole',
  garbage: 'Garbage',
  water_leak: 'Water Leak',
  streetlight: 'Streetlight',
  other: 'Other'
};

const formatDate = (date) => {
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

const ComplaintCard = ({ complaint }) => {
  return (
    <Link
      to={`/complaint/${complaint._id}`}
      className="block bg-white rounded-lg border border-gray-200 hover:shadow-md transition overflow-hidden"
    >
      <div className="flex">
        {complaint.imageUrl ? (
          <img
            src={complaint.imageUrl}
            alt={complaint.title}
            className="w-28 h-28 object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-28 h-28 bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400 text-xs">
            No image
          </div>
        )}
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 truncate">{complaint.title}</h3>
            <StatusBadge status={complaint.status} />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {CATEGORY_LABEL[complaint.category] || 'Other'} · {formatDate(complaint.createdAt)}
          </p>
          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{complaint.description}</p>
        </div>
      </div>
    </Link>
  );
};

export default ComplaintCard;
