const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const connectDB = require('./config/db');
const seedAdmin = require('./utils/seedAdmin');
const authRoutes = require('./routes/auth');
const complaintRoutes = require('./routes/complaints');
const adminRoutes = require('./routes/admin');

const app = express();

// Required for express-rate-limit v7 to read req.ip correctly
// when running behind a proxy (Render, Vercel, Nginx, etc.)
app.set('trust proxy', 1);

// Connect to MongoDB, then seed default admin
connectDB()
  .then(() => seedAdmin())
  .catch((err) => console.error('Startup error:', err));

// Middleware
// Allow:
//  - Any localhost port in dev (handles Vite picking 5174/5175 if 5173 is taken)
//  - The deployed Vercel frontend(s) below (DEFAULT_ALLOWED_ORIGINS)
//  - Whatever you set as CLIENT_URL in .env (comma-separated for multiple)
//  - Any *.vercel.app preview deployment of this project
const DEFAULT_ALLOWED_ORIGINS = [
  'https://civic-system-xi.vercel.app'
];

const envOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...envOrigins])];

app.use(
  cors({
    origin: (origin, callback) => {
      // No origin = same-origin request, mobile app, curl, etc. — allow it.
      if (!origin) return callback(null, true);

      // Always allow any localhost / 127.0.0.1 origin in dev
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      // Allow explicitly whitelisted origins (defaults + CLIENT_URL)
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow Vercel preview deployments for this project
      // (e.g. civic-system-xi-git-main-username.vercel.app)
      if (/^https:\/\/civic-system[\w-]*\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }

      console.warn(`CORS blocked for origin: ${origin}`);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Civic Reporter API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
