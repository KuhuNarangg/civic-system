# Civic Reporter — Smart Civic Issue Reporting System

A full-stack MERN application where citizens report civic issues (potholes, garbage, water leaks, broken streetlights) with geo-tagged photos, and admins manage them through a dashboard. Claude AI auto-categorizes and prioritizes every complaint.

## Features

- Citizen account creation, login, and JWT-protected sessions
- Report new issues with photo, GPS pin (draggable), and reverse-geocoded address
- AI auto-categorization + severity scoring via Google Gemini (free tier)
- Duplicate detection via MongoDB 2dsphere geo queries (100 m radius)
- Live map of all reports (Leaflet + OpenStreetMap, no API key needed)
- Per-complaint detail page with status timeline, upvoting, mini-map
- Admin dashboard with stats, filters, and inline status updates
- Email notifications on status change (Nodemailer)
- Image compression on the client + Cloudinary storage
- Auto-saving draft for the report form (every 10 s)
- Rate limiting (10 submissions per user per day)

## Tech Stack

**Frontend:** React 18 · Vite · TailwindCSS · React Router v6 · Axios · Leaflet.js · react-leaflet
**Backend:** Node.js · Express · Mongoose · JWT · bcryptjs · Multer · Cloudinary · Nodemailer · express-rate-limit
**Database:** MongoDB Atlas
**AI:** Google Gemini (`gemini-2.0-flash`, free tier)
**Geocoding:** Nominatim (OpenStreetMap)

## Folder Structure

```
civic-reporter/
├── client/        React frontend (Vite)
├── server/        Express backend
├── .env.example   Required environment variables
└── README.md
```

## Setup

### 1. Clone and install

```bash
cd server
npm install

cd ../client
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `server/.env` and fill in real values:

```bash
cp .env.example server/.env
```

You will need:

- A free **MongoDB Atlas** cluster — paste the connection string into `MONGO_URI`
- A free **Cloudinary** account — `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- A **Google Gemini API key** from `aistudio.google.com/app/apikey` (free, no card needed) — `GEMINI_API_KEY`
- (Optional) An **SMTP** account (e.g. Gmail App Password) for email notifications
- A long random string for `JWT_SECRET`

### 3. Run in development

In one terminal:

```bash
cd server
npm run dev
# Server on http://localhost:5000
```

In another terminal:

```bash
cd client
npm run dev
# Client on http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:5000` (see `client/vite.config.js`).

### 4. Create an admin user

By default the `/api/auth/register` endpoint only creates citizen accounts. To create an admin:

**Option A** — temporarily set `ALLOW_ADMIN_REGISTRATION=true` in `server/.env`, register with `role: "admin"` from the API, then turn the flag back off.

**Option B** — register normally as a citizen, then update the user's `role` to `"admin"` directly in MongoDB Atlas (Collections → users → edit document).

## Production Deployment

### Backend → Render

1. Push the repo to GitHub.
2. On Render, create a new Web Service from the repo and point it at `/server`.
3. Build command: `npm install`. Start command: `npm start`.
4. Add every variable from `.env.example` to the Render environment.
5. Set `CLIENT_URL` to your Vercel domain.

### Frontend → Vercel

1. Import the same repo on Vercel.
2. Set the project root to `/client`.
3. Add an environment variable `VITE_API_URL=https://<your-render-service>.onrender.com/api`.
4. Build command: `npm run build`. Output directory: `dist`.

## API Reference

### Auth

| Method | Endpoint | Auth | Body |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | — | `{ name, email, password }` |
| POST | `/api/auth/login` | — | `{ email, password }` |
| GET | `/api/auth/me` | JWT | — |

### Complaints

| Method | Endpoint | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/complaints` | JWT | multipart/form-data with `image` |
| GET | `/api/complaints` | — | filters: `category`, `status`, `lat`, `lng`, `radius` |
| GET | `/api/complaints/my` | JWT | current user's complaints |
| GET | `/api/complaints/:id` | — | single complaint |
| PATCH | `/api/complaints/:id/upvote` | JWT | toggle |

### Admin

| Method | Endpoint | Auth |
| --- | --- | --- |
| GET | `/api/admin/complaints` | admin JWT |
| PATCH | `/api/admin/complaints/:id/status` | admin JWT |
| GET | `/api/admin/stats` | admin JWT |

## Notes

- The Nominatim public endpoint requires a `User-Agent` header and is rate-limited to ~1 request/sec — don't hammer it.
- If `GEMINI_API_KEY` is unset, AI classification falls back to category `other`, severity `3`.
- If SMTP is unset, status-change emails are silently skipped.
- The 2dsphere index on `Complaint.location` is required for duplicate detection and `?lat&lng&radius` filtering — Mongoose creates it automatically on first run.
