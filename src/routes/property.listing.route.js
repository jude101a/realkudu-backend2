import { Router } from "express";

import { getAllPropertiesByLocation, getAllPropertiesStats, getSellerAllProperties } from "../controllers/property.listing.controller.js";


const router = Router();



router.post("/getUserSpecific", getAllPropertiesByLocation);
router.post("/getSellerSpecific", getSellerAllProperties);
router.post("/getPropertyStats", getAllPropertiesStats);

export default router;