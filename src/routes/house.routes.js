import express from "express";
import {
  createHouse,
  getHouse,
  getAllHouses,
  getHousesByEstate,
  getStandaloneHouses,
  updateHouseCover,
  updateHouseLawyer,
  updateHouseCaretaker,
  updateHouse,
  deleteHouse
} from "../controllers/house.controller";

const router = express.Router();

router.post("/createHouse", createHouse);

router.get("/", getAllHouses);
router.get("/:id", getHouse);
router.get("/estate/:estateId", getHousesByEstate);
router.get("/:sellerId/standalone", getStandaloneHouses);

router.put("/:id/cover", updateHouseCover);
router.put("/:id/lawyer", updateHouseLawyer);
router.put("/:id/caretaker", updateHouseCaretaker);
router.put("/:id", updateHouse);

router.delete("/:id", deleteHouse);

export default router;
