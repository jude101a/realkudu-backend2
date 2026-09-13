import {
  startPushWorker,
  stopPushWorker,
} from "./push.worker.js";

import {
  startEmailWorker,
  stopEmailWorker,
} from "./email.worker.js";

import {
  startInAppWorker,
  stopInAppWorker,
} from "./inapp.worker.js";


const pushWorker =
  startPushWorker();

const emailWorker =
  startEmailWorker();

const inAppWorker =
  startInAppWorker();


async function shutdown(signal) {
  console.log(
    `\n🛑 ${signal} received. Shutting down workers...`
  );

  try {
    await Promise.all([
      stopPushWorker(),
      stopEmailWorker(),
      stopInAppWorker(),
    ]);

    console.log(
      "✅ All notification workers stopped"
    );

    process.exit(0);

  } catch (error) {
    console.error(
      "❌ Worker shutdown failed:",
      error
    );

    process.exit(1);
  }
}


process.once(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.once(
  "SIGINT",
  () => shutdown("SIGINT")
);

console.log(
  "🚀 Notification worker system started"
);