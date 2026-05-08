import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import ReportForm from './pages/ReportForm';
import ComplaintDetail from './pages/ComplaintDetail';
import MyComplaints from './pages/MyComplaints';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import PrivateRoute from './components/PrivateRoute';

const App = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/complaint/:id" element={<ComplaintDetail />} />
          <Route
            path="/report"
            element={
              <PrivateRoute>
                <ReportForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/my-complaints"
            element={
              <PrivateRoute>
                <MyComplaints />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PrivateRoute adminOnly>
                <AdminDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="*"
            element={
              <div className="flex flex-col items-center justify-center py-20">
                <h1 className="text-4xl font-bold text-gray-900">404</h1>
                <p className="text-gray-600">Page not found</p>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
};

export default App;
