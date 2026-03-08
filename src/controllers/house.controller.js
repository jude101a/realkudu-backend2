import HouseModel from "../models/house.model.js";

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
  try {
    const payload = {
      estateId: req.body.estateId ?? null,
      sellerId: req.body.sellerId,
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
    res.json(house);
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
    res.json(house);
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
  try {
    await HouseModel.softDelete(req.params.id);
    res.json({ message: "House deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
