// disable Redis for tests to avoid connection attempts
process.env.DISABLE_REDIS = 'true';
import pool from '../src/config/db.js';

// Mock pool.query implementation BEFORE importing handlers to avoid real DB calls
import { __setInternalPoolForTests } from '../src/config/db.js';

const mockPool = {
  query: async (sql, params) => {
    if (/SELECT \* FROM notifications/.test(sql)) {
      return { rows: [ { id: '1', user_id: params[0], title: 'Hi', body: 'Hello', created_at: new Date() } ] };
    }
    if (/SELECT token FROM device_tokens/.test(sql)) {
      return { rows: [ { token: 'tok1' }, { token: 'tok2' } ] };
    }
    if (/INSERT INTO device_tokens/.test(sql)) {
      return { rowCount: 1 };
    }
    if (/INSERT INTO onesignal_device_tokens/.test(sql)) {
      return { rowCount: 1 };
    }
    return { rows: [] };
  }
  ,
  on: () => {}
};

// Replace internal pool used by the app with our mock
__setInternalPoolForTests(mockPool);

const originalQuery = pool.query;

// Now import notification handlers with pool.query mocked
import * as notif from '../src/services/notification.service.js';

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res._data = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res._data = data; return res; };
  return res;
}

(async () => {
  try {
    console.log('Test: getUserNotifications with req.user.id');
    const req1 = { user: { id: 'user-123' }, params: {} };
    const res1 = mockRes();
    await notif.getUserNotifications(req1, res1);
    console.log('->', res1.statusCode, res1._data);

    console.log('Test: getUserNotifications with params.userId');
    const req2 = { params: { userId: 'user-456' } };
    const res2 = mockRes();
    await notif.getUserNotifications(req2, res2);
    console.log('->', res2.statusCode, res2._data);

    console.log('Test: saveDeviceToken with auth');
    const req3 = { user: { id: 'user-789' }, body: { token: 'abc' } };
    const res3 = mockRes();
    await notif.saveDeviceToken(req3, res3);
    console.log('->', res3.statusCode, res3._data);

    console.log('Test: saveOneSignalDeviceToken with auth');
    const req4 = { user: { id: 'user-789' }, body: { token: 'onesig' } };
    const res4 = mockRes();
    await notif.saveOneSignalDeviceToken(req4, res4);
    console.log('->', res4.statusCode, res4._data);

    console.log('Test: sendNotification function (enqueue)');
    const job = await notif.sendNotification({ user: { id: 'user-321', email: 'a@b.com' }, title: 'T', message: 'M', data: {} });
    console.log('->', job);

    console.log('All handler tests ran (mocked).');
  } catch (err) {
    console.error('Handler tests failed', err);
  } finally {
    pool.query = originalQuery;
  }
})();
