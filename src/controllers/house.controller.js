import HouseModel from "../models/house.model.js";

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
  try {
    const house = await HouseModel.create(req.body);
    res.status(201).json(house.rows[0]);
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

    if (!house.rowCount) {
      return res.status(404).json({ message: "House not found" });
    }

    res.json(house.rows[0]);
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
    const houses = await HouseModel.findAll();
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @swagger
 * /api/houses/seller/{sellerId}/standalone:
 *   get:
 *     summary: Get standalone houses
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
    const { sellerId, isSingleHouse } = req.query;

    if (!sellerId) {
      return res.status(400).json({
        error: "sellerId is required",
      });
    }

    const standalone =
      isSingleHouse === undefined
        ? true
        : isSingleHouse === "true" || isSingleHouse === true;

    const result = await HouseModel.findStandaloneBySeller(
      sellerId,
      standalone
    );

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
    res.json(house.rows[0]);
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
  try {
    const house = await HouseModel.updateLawyer(
      req.params.id,
      req.body.lawyerId ?? null
    );
    res.json(house.rows[0]);
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
  try {
    const house = await HouseModel.updateCaretaker(
      req.params.id,
      req.body.caretakerId ?? null
    );
    res.json(house.rows[0]);
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
    res.json(house.rows[0]);
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
  try {
    await HouseModel.softDelete(req.params.id);
    res.json({ message: "House deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
