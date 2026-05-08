const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const complaintRoutes = require('./routes/complaints');
const adminRoutes = require('./routes/admin');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
// Allow:
//  - Any localhost port in dev (handles Vite picking 5174/5175 if 5173 is taken)
//  - Whatever you set as CLIENT_URL in .env (production frontend URL)
//  - Multiple comma-separated origins via CLIENT_URL (e.g. "https://a.com,https://b.com")
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // No origin = same-origin request, mobile app, curl, etc. — allow it.
      if (!origin) return callback(null, true);

      // Always allow any localhost / 127.0.0.1 origin in dev
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      // Allow explicitly whitelisted origins from CLIENT_URL
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

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
