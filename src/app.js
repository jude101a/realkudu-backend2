import express from "express";
import cors from "cors";
import * as Sentry from "@sentry/node";
import routes from "./routes/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import paymentRoutes from "./routes/payment.routes.js";
import transferRoutes from "./routes/transfer.routes.js";

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
app.use(

    "/api/transfers",

    transferRoutes

);

// Routes
app.use("/api", routes);

app.get("/debug-sentry", (req, res) => {
  Sentry.logger.info("User triggered test error", {
    action: "test_error_endpoint",
  });
  Sentry.metrics.count("test_counter", 1);
  throw new Error("My first Sentry error!");
});

// The error handler must be registered before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

// Error handler
app.use(errorHandler);

export default app;
