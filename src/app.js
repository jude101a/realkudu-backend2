import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import paymentRoutes from "./routes/payment.routes.js";

const app = express();

// Global Middlewares
app.use(cors());
app.use(

    express.json({

        verify: (req, res, buf) => {

            req.rawBody = buf;

        }

    })

);app.use(express.urlencoded({ extended: true }));


app.use(

    "/api/payments",

    paymentRoutes

);

// Routes
app.use("/api", routes);

// Error handler
app.use(errorHandler);

export default app;
