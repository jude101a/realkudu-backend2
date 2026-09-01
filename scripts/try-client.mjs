import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

(async () => {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Client connected');
    const res = await client.query('SELECT NOW()');
    console.log(res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('Client connection error', err);
    try { await client.end(); } catch(e){}
    process.exit(2);
  }
})();
