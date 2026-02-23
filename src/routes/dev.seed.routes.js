import { Router } from "express";
import { seedTestAssets } from "../controllers/dev.seed.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { seedAssetsSchema } from "../validators/dev.seed.validator.js";

const router = Router();

router.post("/seed/test-assets", protect, validate({ body: seedAssetsSchema }), seedTestAssets);

export default router;
