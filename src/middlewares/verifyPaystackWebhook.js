import { createHmac } from "crypto";

export default (req, res, next) => {

    const signature = req.headers["x-paystack-signature"];

    if (!signature) {

        return res.status(401).json({

            success: false,

            message: "Missing webhook signature."

        });

    }

    const hash = createHmac(

            "sha512",

            process.env.PAYSTACK_SECRET_KEY

        )

        .update(req.rawBody)

        .digest("hex");

    if (hash !== signature) {

        return res.status(401).json({

            success: false,

            message: "Invalid webhook signature."

        });

    }

    next();

};