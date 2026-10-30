import { closePool, withTransaction } from './pool.js';
import { hashPassword } from '../utils/auth.js';

async function seedConfiguredAdmin(client) {
  const username = process.env.SEED_ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!username || !password || !email) { console.log('No admin seed credentials configured; existing database users will be preserved.'); return false; }
  const id = process.env.SEED_ADMIN_ID || 'USR-ADMIN'; const name = process.env.SEED_ADMIN_NAME || 'Clinic Administrator';
  await client.query(`
    INSERT INTO users (id, username, password_hash, name, role, role_title, department, email, avatar_initials, badge_color, is_active)
    VALUES ($1, $2, $3, $4, 'admin', 'System Administrator', 'Clinic Administration', $5, 'CA', '#2563eb', TRUE)
    ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, email = EXCLUDED.email, is_active = TRUE, updated_at = NOW()
  `, [id, username, hashPassword(password), name, email]);
  return true;
}

try {
  await withTransaction(async client => {
    // Clean up any legacy mock doctors if present
    await client.query(`UPDATE queue_items SET assigned_doctor_id = NULL WHERE assigned_doctor_id IN ('D001', 'D002', 'D003', 'D004', 'D005')`);
    await client.query(`DELETE FROM doctors WHERE id IN ('D001', 'D002', 'D003', 'D004', 'D005')`);
    const adminSeeded = await seedConfiguredAdmin(client);
    console.log(`Database initialized without mock data.${adminSeeded ? ' Configured administrator seeded.' : ''}`);
  });
} catch (error) {
  console.error(`Seed failed: ${error.message || error.code || error.name}`);
  process.exitCode = 1;
} finally {
  await closePool();
}
