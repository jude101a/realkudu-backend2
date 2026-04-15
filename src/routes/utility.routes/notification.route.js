import express from 'express';
import { notificationQueue } from '../../queues/notification.queue.js';
import { getUserNotifications } from '../../services/notification.service.js';
// import { sendNotificationToUser, saveOneSignalDeviceToken } from "../../services/notifications.service.js";

const router = express.Router();

// router.get('/send_to_all', sendNotificationToAll);
// router.post('/send_to_user', sendNotificationToUser);
// router.post('/save_one_signal_token', saveOneSignalDeviceToken);

router.get("/get/:id", getUserNotifications);
router.post('/inquiry', async (req, res) => {
  const { userId, propertyId, buyerId } = req.body;
  try {
    await notificationQueue.add('NEW_INQUIRY', {
      userId,
      title: 'New Inquiry',
      body: 'Someone is interested in your property!',
      data: { propertyId, buyerId },
    }, {
      attempts: 3, // Retry 3 times
      backoff: {
        type: 'exponential',
        delay: 5000, // 5 seconds to start
      },
    });

    res.json({ success: true, message: 'Inquiry notification queued.' });
  } catch (err) {
    console.error('Error adding job:', err);
    res.status(500).json({ success: false, error: 'Failed to queue' });
}})


export default router;