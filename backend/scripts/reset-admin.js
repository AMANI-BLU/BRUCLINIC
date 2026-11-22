#!/usr/bin/env node
/**
 * BruClinic — Administrator Credentials Reset CLI
 *
 * Usage:
 *   node scripts/reset-admin.js [username] [password]
 *
 * Examples:
 *   node scripts/reset-admin.js              # Resets to: admin / admin
 *   node scripts/reset-admin.js admin admin  # Resets to: admin / admin
 *   node scripts/reset-admin.js admin secret # Resets to custom password
 */

import { query, closePool, isDatabaseConfigured } from '../src/db/pool.js';
import { hashPassword } from '../src/utils/auth.js';
import { clearAuthRateLimitForUsername } from '../src/middleware/rateLimiter.js';

const targetUsername = (process.argv[2] || 'admin').trim().toLowerCase();
const targetPassword = process.argv[3] || 'admin';

async function main() {
  console.log('\n  ╔══════════════════════════════════════════════════════════════╗');
  console.log('  ║      BruClinic — Administrator Credentials Reset CLI        ║');
  console.log('  ╚══════════════════════════════════════════════════════════════╝\n');

  if (!isDatabaseConfigured()) {
    console.error('  ✗ Error: Database is not configured. Check your backend/.env settings.');
    process.exit(1);
  }

  try {
    const passwordHash = hashPassword(targetPassword);

    // Look for an existing admin user, or any user matching targetUsername
    const existing = await query(
      `SELECT id, username, role, name, email, is_active FROM users
       WHERE LOWER(username) = LOWER($1) OR role = 'admin'
       ORDER BY CASE WHEN LOWER(username) = LOWER($1) THEN 0 ELSE 1 END, created_at ASC
       LIMIT 1`,
      [targetUsername]
    );

    let user;
    if (existing.rows.length > 0) {
      user = existing.rows[0];
      await query(
        `UPDATE users
         SET username = $1,
             password_hash = $2,
             role = 'admin',
             is_active = TRUE,
             updated_at = NOW()
         WHERE id = $3`,
        [targetUsername, passwordHash, user.id]
      );
    } else {
      // Create fresh admin user if none exists
      const res = await query(
        `INSERT INTO users
           (id, username, password_hash, name, role, role_title, department, email, avatar_initials, badge_color, is_active)
         VALUES
           ('USR-ADMIN', $1, $2, 'Clinic Administrator', 'admin', 'System Administrator', 'Clinic Administration', 'admin@bruclinic.local', 'CA', '#2563eb', TRUE)
         ON CONFLICT (id) DO UPDATE
         SET username = EXCLUDED.username,
             password_hash = EXCLUDED.password_hash,
             role = 'admin',
             is_active = TRUE,
             updated_at = NOW()
         RETURNING id, username, role, name, email`,
        [targetUsername, passwordHash]
      );
      user = res.rows[0];
    }

    // Clear any active lockout on this account
    clearAuthRateLimitForUsername(targetUsername);

    console.log('  ✓ Administrator account updated successfully!\n');
    console.log(`    Username : ${targetUsername}`);
    console.log(`    Password : ${targetPassword}`);
    console.log(`    Role     : admin`);
    console.log(`    Status   : Active (Unlocked)\n`);
    console.log('  You can now log in at http://localhost:5173 with these credentials.\n');
  } catch (err) {
    console.error(`  ✗ Failed to reset administrator account: ${err.message}`);
    if (err.code === 'ECONNREFUSED' || err.message?.includes('connect ECONNREFUSED')) {
      console.error('\n  Tip: Ensure your local PostgreSQL service is running on port 5432:');
      console.error('    net start postgresql-x64-18 (in an Administrator terminal)');
      console.error('    or run: docker compose up -d\n');
    }
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main();
