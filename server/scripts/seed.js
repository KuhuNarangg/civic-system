/**
 * Standalone admin seed script.
 *
 * Run with:  node scripts/seed.js
 *
 * Useful when:
 *   - You want to re-create the admin without restarting the full server
 *   - You're debugging login and want to verify the admin exists in DB
 *   - You're running this in CI/CD before deployment
 *
 * Credentials come from these env vars (with defaults):
 *   SEED_ADMIN_EMAIL     (default: admin@civic.gov.in)
 *   SEED_ADMIN_PASSWORD  (default: Admin@1234)
 *   SEED_ADMIN_NAME      (default: Ward Admin)
 */

const path = require('path');
const dotenv = require('dotenv');

// Load .env from the server/ folder (one level up)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const seedAdmin = require('../utils/seedAdmin');

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error('✗ MONGO_URI is not set in server/.env');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected');

    await seedAdmin();

    // Print the admin record so you can confirm it's there
    const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@civic.gov.in').toLowerCase();
    const admin = await User.findOne({ email: adminEmail });
    if (admin) {
      console.log('\nAdmin record in DB:');
      console.log({
        id: admin._id.toString(),
        name: admin.name,
        email: admin.email,
        role: admin.role,
        createdAt: admin.createdAt
      });
    }

    await mongoose.disconnect();
    console.log('\nDone. You can now login at /login');
    process.exit(0);
  } catch (err) {
    console.error('✗ Seed failed:', err.message);
    process.exit(1);
  }
};

run();
