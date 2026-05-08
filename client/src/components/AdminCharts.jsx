import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

const CATEGORY_LABEL = {
  pothole: 'Pothole',
  garbage: 'Garbage',
  water_leak: 'Water Leak',
  streetlight: 'Streetlight',
  other: 'Other'
};

const formatShortDate = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
};

const AdminCharts = ({ byCategory = {}, perDay = [] }) => {
  const categoryData = Object.keys(CATEGORY_LABEL).map((k) => ({
    category: CATEGORY_LABEL[k],
    count: byCategory[k] || 0
  }));

  const dailyData = (perDay || []).map((d) => ({
    date: formatShortDate(d.date),
    count: d.count
  }));

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Bar Chart: by category */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-1">Complaints by Category</h3>
        <p className="text-xs text-gray-500 mb-4">
          Total reports broken down by issue type
        </p>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={categoryData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="category" tick={{ fontSize: 12 }} stroke="#6b7280" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  background: '#1f2937',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff'
                }}
                cursor={{ fill: 'rgba(37, 99, 235, 0.05)' }}
              />
              <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Line Chart: per day */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-1">Complaints Filed (Last 30 Days)</h3>
        <p className="text-xs text-gray-500 mb-4">
          Daily submission volume to spot trends
        </p>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            {dailyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No data yet
              </div>
            ) : (
              <LineChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#6b7280" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    background: '#1f2937',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#2563eb' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AdminCharts;
