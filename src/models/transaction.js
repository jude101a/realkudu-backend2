import mongoose from "mongoose";

const { Schema, model } = mongoose;

const transactionSchema = new Schema(
  {
    // ===========================
    // References
    // ===========================

    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    paystackReference: {
      type: String,
      default: null,
      index: true,
    },

    paystackTransactionId: {
      type: String,
      default: null,
      index: true,
    },

    authorizationCode: {
      type: String,
      default: null,
    },

    accessCode: {
      type: String,
      default: null,
    },

    // ===========================
    // Participants
    // ===========================

    buyerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    agentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },

    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },

    escrowId: {
      type: Schema.Types.ObjectId,
      ref: "Escrow",
      default: null,
    },

    // ===========================
    // Payment Details
    // ===========================

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "NGN",
    },

    gatewayFee: {
      type: Number,
      default: 0,
    },

    netAmount: {
      type: Number,
      default: 0,
    },

    // ===========================
    // Revenue Sharing
    // ===========================

    platformAmount: {
      type: Number,
      default: 0,
    },

    sellerAmount: {
      type: Number,
      default: 0,
    },

    agentAmount: {
      type: Number,
      default: 0,
    },

    platformPercentage: {
      type: Number,
      default: 0,
    },

    sellerPercentage: {
      type: Number,
      default: 0,
    },

    agentPercentage: {
      type: Number,
      default: 0,
    },

    // ===========================
    // Payment Type
    // ===========================

    paymentPurpose: {
      type: String,
      enum: [
        "booking",
        "purchase",
        "rent",
        "inspection",
        "subscription",
        "wallet_topup",
        "escrow",
        "refund",
        "other",
      ],
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: [
        "card",
        "bank_transfer",
        "ussd",
        "bank",
        "wallet",
        "qr",
        "mobile_money",
      ],
      default: "card",
    },

    provider: {
      type: String,
      default: "paystack",
    },

    // ===========================
    // Status
    // ===========================

    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "success",
        "failed",
        "abandoned",
        "cancelled",
        "refunded",
      ],
      default: "pending",
      index: true,
    },

    verified: {
      type: Boolean,
      default: false,
    },

    webhookProcessed: {
      type: Boolean,
      default: false,
    },

    settled: {
      type: Boolean,
      default: false,
    },

    // ===========================
    // Customer
    // ===========================

    customerEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    customerName: {
      type: String,
      default: "",
    },

    customerPhone: {
      type: String,
      default: "",
    },

    // ===========================
    // Metadata
    // ===========================

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    paystackResponse: {
      type: Schema.Types.Mixed,
      default: {},
    },

    verificationResponse: {
      type: Schema.Types.Mixed,
      default: {},
    },

    webhookPayload: {
      type: Schema.Types.Mixed,
      default: {},
    },

    // ===========================
    // Failure
    // ===========================

    failureReason: {
      type: String,
      default: null,
    },

    refundReason: {
      type: String,
      default: null,
    },

    // ===========================
    // Dates
    // ===========================

    initializedAt: {
      type: Date,
      default: Date.now,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    settledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ===========================
// Indexes
// ===========================

transactionSchema.index({ reference: 1 });

transactionSchema.index({ paystackReference: 1 });

transactionSchema.index({ buyerId: 1 });

transactionSchema.index({ sellerId: 1 });

transactionSchema.index({ propertyId: 1 });

transactionSchema.index({ status: 1 });

transactionSchema.index({ paymentPurpose: 1 });

transactionSchema.index({ createdAt: -1 });

// ===========================
// Virtual
// ===========================

transactionSchema.virtual("isSuccessful").get(function () {
  return this.status === "success";
});

// ===========================
// Instance Methods
// ===========================

transactionSchema.methods.markSuccess = function () {
  this.status = "success";
  this.verified = true;
  this.paidAt = new Date();
  this.verifiedAt = new Date();
  return this.save();
};

transactionSchema.methods.markFailed = function (reason) {
  this.status = "failed";
  this.failureReason = reason;
  return this.save();
};

transactionSchema.methods.markRefunded = function (reason) {
  this.status = "refunded";
  this.refundReason = reason;
  this.refundedAt = new Date();
  return this.save();
};

// ===========================
// Static Methods
// ===========================

transactionSchema.statics.findByReference = function (reference) {
  return this.findOne({ reference });
};

transactionSchema.statics.findSuccessful = function () {
  return this.find({ status: "success" });
};

transactionSchema.statics.findPending = function () {
  return this.find({ status: "pending" });
};

transactionSchema.set("toJSON", {
  virtuals: true,
});

transactionSchema.set("toObject", {
  virtuals: true,
});

const Transaction = model("Transaction", transactionSchema);

export default Transaction;