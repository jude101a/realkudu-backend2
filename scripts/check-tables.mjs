import pool from '../src/config/db.js';

(async () => {
  try {
    const client = await pool.connect();
    try {
      const tables = ['notifications','device_tokens','onesignal_device_tokens'];
      for (const t of tables) {
        const { rows } = await client.query(`SELECT to_regclass($1) AS exists`, [t]);
        console.log(t, '=>', rows[0].exists);
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error checking tables', err);
    process.exit(2);
  }
})();
