import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  timeout: 30000
});

// Attach JWT from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cr_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      // Don't redirect during login attempts themselves
      const url = err.config && err.config.url ? err.config.url : '';
      if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
        localStorage.removeItem('cr_token');
        localStorage.removeItem('cr_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
