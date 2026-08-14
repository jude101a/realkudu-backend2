import { randomBytes } from "node:crypto";

import TransferRepository, { TRANSFER_STATUS } from "../repositories/transfer.repository.js";
import paystack from "../utils/paystack.js";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const calculateFees = (amount) => {
  const platformFee = (amount * 2) / 100;
  const agentCommission = (amount * 1) / 100;
  const payoutAmount = amount - platformFee - agentCommission;

  return {
    platformFee,
    agentCommission,
    payoutAmount,
  };
};

const getColumn = (source = {}, camelKey, columnKey = camelKey) =>
  source[columnKey] ?? source[camelKey] ?? null;

class TransferService {
  constructor({ transferRepository = TransferRepository, paystackClient = paystack } = {}) {
    this.transferRepository = transferRepository;
    this.paystack = paystackClient;
  }

  generateReference() {
    return `TRF-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;
  }

  async prepareTransfer({ escrow, recipientCode, reason = "RealKudu Property Settlement" }) {
    if (!escrow) {
      throw new Error("escrow is required");
    }

    if (!recipientCode) {
      throw new Error("recipientCode is required");
    }

    const amount = toNumber(
      escrow.amount ?? escrow.transaction?.amount ?? escrow.transaction?.amount_paid
    );

    if (amount <= 0) {
      throw new Error("transfer amount must be greater than zero");
    }

    const fees = calculateFees(amount);
    const reference = this.generateReference();

    return this.transferRepository.create({
      reference,
      escrowId: getColumn(escrow, "escrowId", "id"),
      sellerId: getColumn(escrow, "sellerId", "seller_id"),
      recipientCode,
      amount,
      platformFee: fees.platformFee,
      agentCommission: fees.agentCommission,
      payoutAmount: fees.payoutAmount,
      status: TRANSFER_STATUS.PENDING,
      gatewayResponse: { reason },
    });
  }

  async sendTransfer(transfer, reason = "RealKudu Property Settlement") {
    if (!transfer?.reference) {
      throw new Error("transfer reference is required");
    }

    if (!transfer?.recipient_code && !transfer?.recipientCode) {
      throw new Error("recipientCode is required");
    }

    const payoutAmount = toNumber(transfer.payout_amount ?? transfer.payoutAmount);

    if (payoutAmount <= 0) {
      throw new Error("payoutAmount must be greater than zero");
    }

    try {
      const response = await this.paystack.initiateTransfer({
        source: "balance",
        amount: Math.round(payoutAmount * 100),
        recipient: transfer.recipient_code ?? transfer.recipientCode,
        reason,
        reference: transfer.reference,
      });

      return this.transferRepository.markProcessing(transfer.reference, response);
    } catch (error) {
      await this.transferRepository.markFailed(transfer.reference, error);
      throw error;
    }
  }

  async initiateTransfer(payload) {
    const transfer = await this.prepareTransfer(payload);
    return this.sendTransfer(transfer, payload.reason);
  }

  async getTransferStatus(reference) {
    if (!reference) {
      throw new Error("reference is required");
    }

    const transfer = await this.transferRepository.findByReference(reference);

    if (!transfer) {
      throw new Error("Transfer not found");
    }

    return transfer;
  }

  async verifyTransfer(reference) {
    const response = await this.paystack.verifyTransfer(reference);
    const status = String(response?.data?.status || response?.status || "").toUpperCase();

    if (status === "SUCCESS") {
      return this.transferRepository.markSuccess(reference, response);
    }

    if (status === "FAILED") {
      return this.transferRepository.markFailed(reference, response);
    }

    if (status === "REVERSED") {
      return this.transferRepository.markReversed(reference, response);
    }

    return this.transferRepository.markProcessing(reference, response);
  }

  async listSellerTransfers(sellerId, options = {}) {
    if (!sellerId) {
      throw new Error("sellerId is required");
    }

    return this.transferRepository.findBySeller(sellerId, options);
  }

  async markSuccessful(reference, response = {}) {
    return this.transferRepository.markSuccess(reference, response);
  }

  async markFailed(reference, response = {}) {
    return this.transferRepository.markFailed(reference, response);
  }
}

export { TRANSFER_STATUS, TransferService };
export default new TransferService();
