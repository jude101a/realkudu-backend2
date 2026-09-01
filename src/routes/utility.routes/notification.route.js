import express from 'express';
import { notificationQueue } from '../../queues/notification.queue.js';
import { getUserNotifications } from '../../services/notification.service.js';

const router = express.Router();

router.get("/get/:userId", getUserNotifications);

router.post('/inquiry', async (req, res) => {
  const { userId, propertyId, buyerId } = req.body;
  try {
    await notificationQueue.add('NEW_INQUIRY', {
      userId,
      title: 'New Inquiry',
      body: 'Someone is interested in your property!',
      data: { propertyId, buyerId },
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
    res.json({ success: true, message: 'Inquiry notification queued.' });
  } catch (err) {
    console.error('Error adding job:', err);
    res.status(500).json({ success: false, error: 'Failed to queue' });
  }
});

export default router;