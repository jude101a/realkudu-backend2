import HouseModel from "../models/house.model.js";
import ImagesModel from "../models/utility.models/images.js";
import SellerModel from "../models/seller.model.js";
import jwt from "jsonwebtoken";
import { sendNotification } from "../services/notification.service.js";

import {findUserById} from "../models/user.models.js";
import { toMediaPayload } from "../controllers/utillity.controller/images.controller.js";

const parseBooleanQuery = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
};

/**
 * @swagger
 * /api/houses:
 *   post:
 *     summary: Create house
 *     description: Create a new house listing
 *     tags:
 *       - Houses
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: House created
 *       500:
 *         description: Server error
 */
export const createHouse = async (req, res) => {

  const token = req.headers.authorization?.split(' ')[1];
    const user_id = jwt.verify(token, process.env.JWT_SECRET);
    const seller = await SellerModel.findByUserId(user_id);
  try {
    const payload = {
      estateId: req.body.estateId ?? null,
      lawyerId: req.body.lawyerId || null,
      caretakerId: req.body.caretakerId || null,
      name: req.body.name,
      type: req.body.type,
      address: req.body.address,
      coverImageUrl: req.body.coverImageUrl ?? null,
      isSingleHouse: req.body.isSingleHouse === true,
      state: req.body.state,
      lga: req.body.lga,
    };

    const result = await HouseModel.create(payload);

    // Attach uploaded images if provided
    const files = req.files || (req.file ? [req.file] : []);
    if (files.length) {
      const uploads = req.images;
      try {
        

        const coverIndex = Number(req.body.coverIndex);
        const images = uploads.map((upload, index) =>
          toMediaPayload({
            propertyId: result.house_id,
            isCover: Number.isInteger(coverIndex) && coverIndex === index,
            file: files[index],
            upload,
          })
        );

        await ImagesModel.insertMultipleImages(result.house_id, images);
      } catch (err) {
        console.error("error uploading house images", err?.message || err);
      }
    }

    try {
      await sendNotification({
        title: "Property creation",
        body: "${result.title} has been created successfully.\n Let's market this together!!.",
        channels: ["EMAIL", "PUSH"],
        data: {
          "property": result
        },
        email: seller.email,
        jobName: "sendAccountActionEmail",
        userName: seller.first_name,
        userId: seller.sellerId,
      });
    } catch (error) {
      logger.error("Failed to send house creation notification:", error.message || error);
    }

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


/**
 * @swagger
 * /api/houses/{id}:
 *   get:
 *     summary: Get house by ID
 *     description: Retrieve a house by its ID
 *     tags:
 *       - Houses
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: House retrieved
 *       404:
 *         description: House not found
 *       500:
 *         description: Server error
 */
export const getHouse = async (req, res) => {
  try {
    const house = await HouseModel.findById(req.params.id);

    if (!house) {
      return res.status(404).json({ message: "House not found" });
    }

    res.json(house);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @swagger
 * /api/houses:
 *   get:
 *     summary: Get all houses
 *     description: Retrieve all houses in the system
 *     tags:
 *       - Houses
 *     responses:
 *       200:
 *         description: All houses retrieved
 *       500:
 *         description: Server error
 */
export const getAllHouses = async (req, res) => {
  try {
    const { page, limit, sortBy, sortOrder, sellerId, estateId, isSingleHouse, state, lga, type, q } = req.query;
    const filters = {
      sellerId,
      estateId,
      isSingleHouse: parseBooleanQuery(isSingleHouse),
      state,
      lga,
      type,
      q,
    };
    const houses = await HouseModel.findAll({
      page,
      limit,
      sortBy,
      sortOrder,
      filters,
    });
    res.json(houses.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @swagger
 * /api/houses/estate/{estateId}:
 *   get:
 *     summary: Get houses by estate
 *     description: Retrieve all houses in an estate
 *     tags:
 *       - Houses
 *     parameters:
 *       - in: path
 *         name: estateId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Houses retrieved
 *       500:
 *         description: Server error
 */
export const getHousesByEstate = async (req, res) => {
  try {
    const houses = await HouseModel.findByEstate(req.params.estateId);
    res.json(houses.rows);
    console.log(res.json(houses.rows))
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getHousesBySeller = async (req, res) => {
  try {
    const houses = await HouseModel.findBySeller(req.params.sellerId);
    res.json(houses.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @swagger
 * /api/houses/standalone/:sellerId:
 *   get:
 *     summary: Get non estate single listed houses for the seller
 *     description: Get houses not part of an estate
 *     tags:
 *       - Houses
 *     parameters:
 *       - in: path
 *         name: sellerId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Standalone houses retrieved
 *       500:
 *         description: Server error
 */
export const getStandaloneHouses = async (req, res) => {
  try {
    const sellerId = req.params.sellerId || req.query.sellerId;
    const isSingleHouse = parseBooleanQuery(req.query.isSingleHouse) ?? true;

    if (!sellerId) {
      return res.status(400).json({
        error: "sellerId is required",
      });
    }

    const result = await HouseModel.findStandaloneBySeller(sellerId, isSingleHouse);

    res.status(200).json(result.rows ?? []);
  } catch (error) {
    console.error("Get standalone houses failed:", error);
    res.status(500).json({
      error: "Failed to fetch houses",
    });
  }
};



/**
 * @swagger
 * /api/houses/estateHouses/:sellerId/:estateId
 *   get:
 *     summary: Get estate houses
 *     description: Get houses that are part of an estate
 *     tags:
 *       - Houses
 *     parameters:
 *       - in: path
 *         name: sellerId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: estateId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estate houses retrieved
 *       500:
 *         description: Server error
 */
export const getEstateHousesBySeller = async (req, res) => {
  try {
    const sellerId = req.params.sellerId || req.query.sellerId;
    const estateId = req.params.estateId || req.query.estateId;

    if (!sellerId || !estateId) {
      return res.status(400).json({
        error: "sellerId and estateId are required",
      });
    }

    const result = await HouseModel.getEstateHousesBySeller(sellerId, estateId);

    res.status(200).json(result.rows ?? []);
  } catch (error) {
    console.error("Get estate houses failed:", error);
    res.status(500).json({
      error: "Failed to fetch houses",
    });
  }
};


/**
 * @swagger
 * /api/houses/{id}/cover:
 *   put:
 *     summary: Update house cover image
 *     description: Update the cover image for a house
 *     tags:
 *       - Houses
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               coverImageUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cover image updated
 *       500:
 *         description: Server error
 */
export const updateHouseCover = async (req, res) => {
  try {
    const house = await HouseModel.updateCoverImage(
      req.params.id,
      req.body.coverImageUrl
    );
    res.json(house);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @swagger
 * /api/houses/{id}/cover:
 *   put:
 *     summary: Update house cover image
 *     description: Update the cover image for a house
 *     tags:
 *       - Houses
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               coverImageUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cover image updated
 *       500:
 *         description: Server error
 */
export const updateHouseDescription = async (req, res) => {
  try {
    const house = await HouseModel.updateCoverImage(
      req.params.id,
      req.body.houseDescription
    );
    res.json(house);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @swagger
 * /api/houses/{id}/lawyer:
 *   put:
 *     summary: Assign lawyer to house
 *     description: Update the lawyer assigned to a house
 *     tags:
 *       - Houses
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lawyerId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Lawyer assigned
 *       500:
 *         description: Server error
 */
export const updateHouseLawyer = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
    const { user_id, seller_id } = jwt.verify(token, process.env.JWT_SECRET);
// const lawyer = await LawyerModel.findById(req.body.lawyerId); TODO: Uncomment this line when LawyerModel is available
  try {
    const house = await HouseModel.updateLawyer(
      req.params.id,
      req.body.lawyerId ?? null
    );
    res.json(house);
    try {
      await sendNotification({
  title: "Lawyer Assigned",
  body: `You have assigned {lawyer.name} as your lawyer in charge of ${house.name}.\nThe firm will now be in charge of legal affairs of the property.\nIf you did not make this change, please contact support immediately.`,
  channels: ["EMAIL"],
  data: {},
  email: seller.email,
  jobName: "sendAccountActionEmail",
  userName: seller.first_name,
  userId: seller_id,
});

await sendNotification({
  title: "You have been Assigned",
  body: `You have been assigned as the lawyer in charge of ${house.name}.\nYour firm will now be in charge of legal affairs of the property.\nHead to your dashboard to view the details.\n You can cancel this assignment at any time.`,
  channels: ["EMAIL", "PUSH"],
  data: {},
  email: lawyer.email,
  jobName: "sendAccountActionEmail",
  userName: lawyer.first_name,
  userId: lawyer_id,
});
    } catch (error) {
      logger.error("Failed to send set lawyer status update notification:", error.message || error);
    }
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @swagger
 * /api/houses/{id}/caretaker:
 *   put:
 *     summary: Assign caretaker to house
 *     description: Update the caretaker assigned to a house
 *     tags:
 *       - Houses
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               caretakerId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Caretaker assigned
 *       500:
 *         description: Server error
 */
export const updateHouseCaretaker = async (req, res) => {

  const token = req.headers.authorization?.split(' ')[1];
    const { user_id, seller_id } = jwt.verify(token, process.env.JWT_SECRET);
    const caretaker = await findUserById(req.body.caretakerId);
  try {
    const house = await HouseModel.updateCaretaker(
      req.params.id,
      req.body.caretakerId ?? null
    );
    res.json(house);

    try {
      await sendNotification({
        title: "Caretaker Change",
        body: `You have assigned ${caretaker.first_name} as the caretaker for ${house.name}.\nIf you did not make this change, please contact support immediately.`,
        channels: ["EMAIL"],
        data: {},
        email: seller.email,
        jobName: "sendAccountActionEmail",
        userName: seller.first_name,
        userId: seller_id,
      });

      await sendNotification({
  title: "Caretaker Assigned",
  body: `You have been assigned as the caretaker for ${house.name}.\nIf you did not make this change, please contact support immediately.`,
  channels: ["EMAIL"],
  data: {},
  email: caretaker.email,
  jobName: "sendAccountActionEmail",
  userName: caretaker.first_name,
  userId: caretaker.caretaker_id,
});
    } catch (error) {
      logger.error("Failed to send set caretaker status update notification:", error.message || error);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @swagger
 * /api/houses/{id}:
 *   put:
 *     summary: Update house details
 *     description: Update general house information
 *     tags:
 *       - Houses
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: House updated
 *       500:
 *         description: Server error
 */
export const updateHouse = async (req, res) => {
  try {
    const house = await HouseModel.updateFields(
      req.params.id,
      req.body
    );
    res.json(house);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @swagger
 * /api/houses/{id}:
 *   delete:
 *     summary: Delete house
 *     description: Soft delete a house
 *     tags:
 *       - Houses
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: House deleted
 *       500:
 *         description: Server error
 */
export const deleteHouse = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
    const { user_id, seller_id } = jwt.verify(token, process.env.JWT_SECRET);
  if (!user_id || !seller_id) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const seller = await SellerModel.findById(seller_id);
    try {
    await HouseModel.softDelete(req.params.id);
    res.json({ message: "House deleted successfully" });

    await sendNotification({
  title: "Property Deletion",
  body: `You have deleted the property ${house.name}.\nIf you did not make this change, please contact support immediately.`,
  channels: ["EMAIL"],
  data: {},
  email: seller.email,
  jobName: "sendAccountActionEmail",
  userName: seller.first_name,
  userId: seller_id,
});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
export const softDeleteHouse = async (req, res) => {
  try {
    await HouseModel.softDeleteHouse(req.params.id);
    res.json({ message: "House deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
