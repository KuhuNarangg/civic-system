const User = require('../models/User');

/**
 * Seed a default admin user on server startup.
 *
 * Credentials (override with env vars):
 *   SEED_ADMIN_EMAIL    (default: admin@civic.gov.in)
 *   SEED_ADMIN_PASSWORD (default: Admin@1234)
 *   SEED_ADMIN_NAME     (default: Ward Admin)
 *
 * Behavior:
 *   - If no user with this email exists → create one with role: 'admin'
 *   - If a user exists but role !== 'admin' → promote to admin
 *   - If admin already exists → no-op
 *
 * Password is hashed automatically by the User model's pre-save hook.
 */
const seedAdmin = async () => {
  try {
    const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@civic.gov.in').toLowerCase();
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@1234';
    const adminName = process.env.SEED_ADMIN_NAME || 'Ward Admin';

    const existing = await User.findOne({ email: adminEmail });

    if (existing) {
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        await existing.save();
        console.log(`✓ Promoted ${adminEmail} to admin`);
      } else {
        console.log(`✓ Admin already exists: ${adminEmail}`);
      }
      return;
    }

    await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: 'admin'
    });

    console.log('═══════════════════════════════════════════');
    console.log('✓ DEFAULT ADMIN SEEDED');
    console.log('  Email:    ' + adminEmail);
    console.log('  Password: ' + adminPassword);
    console.log('  → Login at /login and change the password.');
    console.log('═══════════════════════════════════════════');
  } catch (err) {
    console.error('Seed admin error:', err.message);
  }
};

module.exports = seedAdmin;
