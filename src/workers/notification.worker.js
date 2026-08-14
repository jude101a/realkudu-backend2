import { Worker } from "bullmq";
import { redisConnectionOptions } from "../config/redis.js";
import { sendPush } from "../services/push.notification.service.js";
import { sendEmail } from "../services/email.service.js";
import { saveNotification } from "../services/notifications.service.js";

const processJob = async (job) => {
	const name = job.name || job.data?.type;
	const payload = job.data?.payload || job.data || {};

	console.log(`[notification_worker] processing job ${job.id} name=${name}`);

	try {
		switch (name) {
			case "IN_APP": {
				const { userId, title, message, meta } = payload;
				try {
					await saveNotification({ userId, title, body: message, data: meta });
				} catch (err) {
					console.error('[notification_worker] saveNotification failed', err);
				}
				return { ok: true };
			}

			case "PUSH": {
				const { tokens = [], title, body, data = {}, userId } = payload;

				if (tokens.length === 0) {
					console.warn('[notification_worker] PUSH job without tokens');
				}

				const results = await Promise.allSettled(
					tokens.map((token) => sendPush({ token, title, body, data }))
				);

				// Persist as in-app notification when userId is provided
				if (userId) {
					try {
						await saveNotification({ userId, title, body, data });
					} catch (err) {
						console.error('[notification_worker] saveNotification failed', err);
					}
				}

				return { ok: true, results };
			}

			case "EMAIL": {
				const { to, subject, html, userId } = payload;

				try {
					await sendEmail({ to, subject, html });
				} catch (err) {
					console.error('[notification_worker] sendEmail failed', err);
				}

				if (userId) {
					try {
						await saveNotification({ userId, title: subject, body: html, data: {} });
					} catch (err) {
						console.error('[notification_worker] saveNotification failed', err);
					}
				}

				return { ok: true };
			}

			default: {
				console.warn('[notification_worker] unknown job type', name);
				return { ok: false };
			}
		}
	} catch (error) {
		console.error('[notification_worker] job handler error', error);
		throw error;
	}
};

const worker = new Worker(
	"notifications",
	async (job) => processJob(job),
	{
		connection: {
			url: process.env.REDIS_URL,
			...redisConnectionOptions,
		},
		concurrency: 5,
	}
);

worker.on("completed", (job) => {
	console.log(`[notification_worker] job completed ${job.id}`);
});

worker.on("failed", (job, err) => {
	console.error(`[notification_worker] job failed ${job?.id}`, err?.message || err);
});

console.log("✅ Notification worker initialized");

export default worker;