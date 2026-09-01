import { ensureDatabaseConnectivity } from '../src/config/db.js';

(async () => {
  try {
    await ensureDatabaseConnectivity();
    console.log('DB connectivity test succeeded');
    process.exit(0);
  } catch (err) {
    console.error('DB connectivity test failed', err);
    process.exit(2);
  }
})();
