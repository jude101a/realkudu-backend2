import express from "express";

const router = express.Router();


import WebhookController from "../controllers/webhook.controller.js";

import verifyWebhook from "../middlewares/verifyPaystackWebhook.js";



router.post(

    "/paystack",

    verifyWebhook,

    WebhookController.handle

);

export default router;