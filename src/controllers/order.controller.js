
import OrderModel from "../models/order.model.js";
import pool from "../config/db.js";
import AppError from "../utils/appError.js";
import jwt from "jsonwebtoken";

export const createOrder = async (req, res, next) => {
  try {
    const tokenUser = jwt.decode(req.headers.authorization?.split(" ")[1]);
    const buyerId = tokenUser.id;

    if (!buyerId) {
      throw new AppError("Unauthorized", 401);
    }

    const {
      propertyId,
      quantity = 1,
      paymentType = "booking",
      bookingFee = 0,
      agreedAmount,
      amountPaid = 0,
      currency = "NGN",
      propertyType,
      inspectionRequired = true,
      governmentConsentRequired = true,
      agentId = null,
      lawyerId = null,
      notes = null,
    } = req.body;

    if (!propertyId) {
      throw new AppError("propertyId is required", 400);
    }

    if (!quantity || Number(quantity) <= 0) {
      throw new AppError(
        "quantity must be greater than 0",
        400
      );
    }

    if (agreedAmount === undefined || agreedAmount === null) {
      throw new AppError(
        "agreedAmount is required",
        400
      );
    }

    if (Number(agreedAmount) < 0) {
      throw new AppError(
        "agreedAmount cannot be negative",
        400
      );
    }

    /*
     * Get the property and its seller.
     */
    const {
      rows: [property],
    } = await pool.query(
      `
        SELECT
          property_id,
          seller_id,
          property_type,
          price,
          quantity AS available_quantity
        FROM property
        WHERE property_id = $1
          AND deleted_at IS NULL
      `,
      [propertyId]
    );

    if (!property) {
      throw new AppError(
        "Property not found",
        404
      );
    }

    /*
     * Make sure the requested quantity does not exceed
     * the currently available inventory.
     */
    const {
      rows: [inventory],
    } = await pool.query(
      `
        SELECT
          COALESCE(
            SUM(po.quantity) FILTER (
              WHERE po.status <> 'declined'
            ),
            0
          ) AS ordered_quantity
        FROM property_orders po
        WHERE po.property_id = $1
          AND po.deleted_at IS NULL
      `,
      [propertyId]
    );

    const orderedQuantity = Number(
      inventory?.ordered_quantity || 0
    );

    const propertyQuantity = Number(
      property.available_quantity || 0
    );

    const availableQuantity =
      propertyQuantity - orderedQuantity;

    if (Number(quantity) > availableQuantity) {
      throw new AppError(
        `Only ${availableQuantity} plot(s) are available`,
        409
      );
    }

    /*
     * Use the property's seller and property type.
     * Do not trust these values from the client.
     */
    const sellerId = property.seller_id;

    const resolvedPropertyType =
      propertyType || property.property_type;

    /*
     * Create the order.
     */
    const { order, step } =
      await OrderModel.create(
        {
          buyerId,

          sellerId,

          agentId,
          lawyerId,

          propertyId,

          quantity: Number(quantity),

          propertyType:
            resolvedPropertyType,

          status: "pending",

          paymentType,

          bookingFee: Number(bookingFee),

          agreedAmount:
            Number(agreedAmount),

          amountPaid:
            Number(amountPaid),

          currency,

          inspectionRequired,

          inspectionCompleted: false,

          dueDiligenceCompleted: false,

          agreementSigned: false,

          governmentConsentRequired,

          notes,

          purchaseStep: "booking_fee",

          funnelStep: "payment",

          docsVerified: false,
        },

        {
          propertyId,

          quantity: Number(quantity),

          bookingFee: Number(bookingFee),

          agreedAmount:
            Number(agreedAmount),

          buyerId,

          sellerId,
        }
      );

    return res.status(201).json({
      success: true,

      message: "Order created successfully",

      data: {
        order,
        step,
      },
    });
  } catch (error) {
    next(error);
  }
};


export const getOrderById = async (
  req,
  res,
  next
) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      throw new AppError(
        "orderId is required",
        400
      );
    }

    const order =
      await OrderModel.findById(orderId);

    if (!order) {
      throw new AppError(
        "Order not found",
        404
      );
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};


export const getMyOrders = async (
  req,
  res,
  next
) => {
  try {
    const buyerId = req.user?.id;

    if (!buyerId) {
      throw new AppError(
        "Unauthorized",
        401
      );
    }

    const limit = Math.min(
      Number(req.query.limit) || 20,
      100
    );

    const offset =
      Math.max(
        Number(req.query.offset) || 0,
        0
      );

    const orders =
      await OrderModel.findByUserId(
        buyerId,
        {
          limit,
          offset,
        }
      );

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        limit,
        offset,
        count: orders.length,
      },
    });
  } catch (error) {
    next(error);
  }
};


export const getPropertyOrders = async (
  req,
  res,
  next
) => {
  try {
    const { propertyId } = req.params;

    if (!propertyId) {
      throw new AppError(
        "propertyId is required",
        400
      );
    }

    const orders =
      await OrderModel.findByPropertyId(
        propertyId
      );

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};


export const getSellerOrders = async (
  req,
  res,
  next
) => {
  try {
    const sellerId = req.user?.id;

    if (!sellerId) {
      throw new AppError(
        "Unauthorized",
        401
      );
    }

    const limit = Math.min(
      Number(req.query.limit) || 20,
      100
    );

    const offset =
      Math.max(
        Number(req.query.offset) || 0,
        0
      );

    const orders =
      await OrderModel.findBySellerId(
        sellerId,
        {
          limit,
          offset,
        }
      );

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        limit,
        offset,
        count: orders.length,
      },
    });
  } catch (error) {
    next(error);
  }
};


export const advanceOrderStep = async (
  req,
  res,
  next
) => {
  try {
    const { orderId } = req.params;
    const {
      step,
      stepData = {},
    } = req.body;

    if (!orderId) {
      throw new AppError(
        "orderId is required",
        400
      );
    }

    if (!step) {
      throw new AppError(
        "step is required",
        400
      );
    }

    const result =
      await OrderModel.advanceStep(
        orderId,
        step,
        stepData
      );

    return res.status(200).json({
      success: true,
      message: "Order step advanced successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};


export const completeOrder = async (
  req,
  res,
  next
) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      throw new AppError(
        "orderId is required",
        400
      );
    }

    const order =
      await OrderModel.markCompleted(
        orderId
      );

    return res.status(200).json({
      success: true,
      message: "Order completed successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};


export const failOrder = async (
  req,
  res,
  next
) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      throw new AppError(
        "orderId is required",
        400
      );
    }

    const order =
      await OrderModel.markFailed(
        orderId
      );

    return res.status(200).json({
      success: true,
      message: "Order marked as failed",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};


export const getOrderHistory = async (
  req,
  res,
  next
) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      throw new AppError(
        "orderId is required",
        400
      );
    }

    const history =
      await OrderModel.getFullHistory(
        orderId
      );

    if (!history) {
      throw new AppError(
        "Order not found",
        404
      );
    }

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

