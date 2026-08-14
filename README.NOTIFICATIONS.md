Notification worker

This project uses BullMQ for background jobs. The `notifications` queue is used to send user-facing notifications when important events occur (listing approved/rejected, KYC status changes).

Quick start (local):

1. Ensure Redis is running and `REDIS_URL` is set in your environment.
2. Start the notification worker in a separate terminal:

```bash
node -e "import('./src/workers/notification.worker.js')"
```

Behavior
- The worker currently uses a placeholder `sendNotification` that logs the job payload.
- Replace `sendNotification` in `src/workers/notification.worker.js` with real integrations (email, push, SMS) and persist notifications to the DB as needed.
