import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user && user.role === 'admin';

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition ${
      isActive ? 'bg-brand-600 text-white' : 'text-gray-700 hover:bg-gray-100'
    }`;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-[1000]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold">
              C
            </div>
            <span className="font-bold text-lg text-gray-900">Civic Reporter</span>
            {isAdmin && (
              <span className="hidden sm:inline ml-1 px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                ADMIN
              </span>
            )}
          </Link>

          <div className="hidden md:flex items-center gap-2">
            <NavLink to="/" end className={linkClass}>
              Map
            </NavLink>

            {/* Citizen-only links */}
            {user && !isAdmin && (
              <>
                <NavLink to="/report" className={linkClass}>
                  Report Issue
                </NavLink>
                <NavLink to="/my-complaints" className={linkClass}>
                  My Reports
                </NavLink>
              </>
            )}

            {/* Logged-out: show Report (will redirect to login) */}
            {!user && (
              <NavLink to="/report" className={linkClass}>
                Report Issue
              </NavLink>
            )}

            {/* Admin-only link */}
            {isAdmin && (
              <NavLink to="/admin" className={linkClass}>
                Admin Dashboard
              </NavLink>
            )}
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden sm:inline text-sm text-gray-600">
                  Hi, {user.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded-md hover:bg-brand-700"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden flex items-center gap-1 pb-2 overflow-x-auto">
          <NavLink to="/" end className={linkClass}>
            Map
          </NavLink>
          {user && !isAdmin && (
            <>
              <NavLink to="/report" className={linkClass}>
                Report
              </NavLink>
              <NavLink to="/my-complaints" className={linkClass}>
                My Reports
              </NavLink>
            </>
          )}
          {!user && (
            <NavLink to="/report" className={linkClass}>
              Report
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={linkClass}>
              Admin
            </NavLink>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
