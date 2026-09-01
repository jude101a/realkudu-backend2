import { Worker } from "bullmq";
import { getRedisConnectionConfig } from "../config/redis.js";
import { sendPush } from "../services/push.notification.service.js";
import { sendEmail } from "../services/email.service.js";
import { saveNotification } from "../services/notifications.service.js";


const processJob = async (job) => {
	const startedAt = Date.now();
	const name = job.name || job.data?.type;
	const payload = job.data?.payload || job.data || {};

	console.info(`[notification_worker] processing job`, { jobId: job.id, name, payloadPreview: JSON.stringify(payload).slice(0, 200) });

	try {
		switch (name) {
			case "IN_APP": {
				const { userId, title, message, meta } = payload;
				const opStart = Date.now();
				try {
					await saveNotification({ userId, title, body: message, data: meta });
					console.info('[notification_worker] IN_APP saved', { jobId: job.id, userId, durationMs: Date.now() - opStart });
				} catch (err) {
					console.error('[notification_worker] saveNotification failed', { jobId: job.id, error: err?.message || err });
				}
				return { ok: true };
			}

			case "PUSH": {
				const { tokens = [], title, body, data = {}, userId } = payload;
				console.debug('[notification_worker] PUSH job details', { jobId: job.id, tokenCount: tokens.length, userId });

				if (tokens.length === 0) {
					console.warn('[notification_worker] PUSH job without tokens', { jobId: job.id });
				}

				const sendStart = Date.now();
				const results = await Promise.allSettled(
					tokens.map((token) => sendPush({ token, title, body, data }))
				);
				console.info('[notification_worker] PUSH results', { jobId: job.id, durationMs: Date.now() - sendStart, settled: results.length });

				if (userId) {
					try {
						await saveNotification({ userId, title, body, data });
						console.info('[notification_worker] PUSH saved notification for user', { jobId: job.id, userId });
					} catch (err) {
						console.error('[notification_worker] saveNotification failed', { jobId: job.id, error: err?.message || err });
					}
				}

				return { ok: true, results };
			}

			case "EMAIL": {
				const { to, subject, html, userId } = payload;
				console.debug('[notification_worker] EMAIL job details', { jobId: job.id, to, subject, userId });

				try {
					await sendEmail({ to, subject, html });
					console.info('[notification_worker] EMAIL sent', { jobId: job.id, to });
				} catch (err) {
					console.error('[notification_worker] sendEmail failed', { jobId: job.id, error: err?.message || err });
				}

				if (userId) {
					try {
						await saveNotification({ userId, title: subject, body: html, data: {} });
						console.info('[notification_worker] EMAIL saved notification for user', { jobId: job.id, userId });
					} catch (err) {
						console.error('[notification_worker] saveNotification failed', { jobId: job.id, error: err?.message || err });
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
		console.error('[notification_worker] job handler error', { jobId: job.id, error: error?.message || error });
		throw error;
	}
};

const connection = getRedisConnectionConfig();

let worker = null;

if (!connection) {
	console.warn("⚠️ Notification worker disabled because Redis is unavailable.");
} else {
	worker = new Worker(
		"notifications",
		async (job) => processJob(job),
		{
			connection,
			concurrency: 5,
		}
	);

	worker.on("completed", (job) => {
		console.info(`[notification_worker] job completed`, { jobId: job.id, durationMs: Date.now() - (job.timestamp || Date.now()) });
	});

	worker.on("failed", (job, err) => {
		console.error(`[notification_worker] job failed`, { jobId: job?.id, error: err?.message || err });
	});

	console.log("✅ Notification worker initialized");
	globalThis.__notificationWorker = worker;
}

export default worker;