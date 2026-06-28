import {WebhookService} from "../services/webhooks.service.js";

class WebhookController {

    async handle(req, res, next) {

        try {

            await WebhookService.process(req.body);

            return res.sendStatus(200);

        }

        catch (err) {

            next(err);

        }

    }

}

export default new WebhookController();