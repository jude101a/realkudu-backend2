import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeNotificationInput } from '../src/services/notification.service.js';

test('normalizeNotificationInput accepts user object and message alias', () => {
  const result = normalizeNotificationInput({
    user: { id: 'user-123', email: 'user@example.com' },
    title: 'Login Alert',
    message: 'Welcome back!',
    channels: ['PUSH'],
    data: {},
  });

  assert.equal(result.userId, 'user-123');
  assert.equal(result.body, 'Welcome back!');
  assert.deepEqual(result.channels, ['PUSH']);
});
