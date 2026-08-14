import EscrowRepository from "../repositories/escrow.repository.js";
import pool from "../config/db.js";
import WalletService from "./wallet.service.js";

export const ESCROW_STATUS = Object.freeze({
  PENDING: "PENDING",
  HELD: "HELD",
  RELEASED: "RELEASED",
  DISPUTED: "DISPUTED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
});

const normalizeStatus = (status) => String(status || "").toUpperCase();

const getColumn = (source = {}, camelKey, columnKey = camelKey) =>
  source[columnKey] ?? source[camelKey] ?? null;

const normalizeTransactionPayload = (transaction = {}) => ({
  transactionId: getColumn(transaction, "transactionId", "id"),
  propertyId: getColumn(transaction, "propertyId", "property_id"),
  buyerId: getColumn(transaction, "buyerId", "buyer_id"),
  sellerId: getColumn(transaction, "sellerId", "seller_id"),
  agentId: getColumn(transaction, "agentId", "agent_id"),
});

const assertTransition = (from, to) => {
  const current = normalizeStatus(from);
  const next = normalizeStatus(to);

  const allowed = {
    [ESCROW_STATUS.PENDING]: new Set([ESCROW_STATUS.HELD, ESCROW_STATUS.CANCELLED]),
    [ESCROW_STATUS.HELD]: new Set([
      ESCROW_STATUS.RELEASED,
      ESCROW_STATUS.DISPUTED,
      ESCROW_STATUS.REFUNDED,
    ]),
    [ESCROW_STATUS.DISPUTED]: new Set([ESCROW_STATUS.RELEASED, ESCROW_STATUS.REFUNDED]),
  };

  if (current === next) return;

  if (!allowed[current]?.has(next)) {
    throw new Error(`Invalid escrow status transition: ${current || "UNKNOWN"} -> ${next}`);
  }
};

export class EscrowService {
  constructor({
    escrowRepository = EscrowRepository,
    transfers = null,
    walletService = WalletService,
    db = pool,
  } = {}) {
    this.escrowRepository = escrowRepository;
    this.transferService = transfers;
    this.walletService = walletService;
    this.db = db;
  }

  async getTransferService() {
    if (!this.transferService) {
      const module = await import("./transfer.service.js");
      this.transferService = module.default;
    }

    return this.transferService;
  }

  async createFromTransaction(transaction) {
    const payload = normalizeTransactionPayload(transaction);

    if (!payload.transactionId) {
      throw new Error("transactionId is required to create escrow");
    }

    return this.escrowRepository.create({
      ...payload,
      status: ESCROW_STATUS.PENDING,
    });
  }

  async findByTransaction(transactionId) {
    return this.escrowRepository.findByTransaction(transactionId);
  }

  async findByProperty(propertyId) {
    return this.escrowRepository.findByProperty(propertyId);
  }

  async updateStatus(id, nextStatus) {
    const escrow = await this.escrowRepository.findById(id);

    if (!escrow) {
      throw new Error("Escrow not found");
    }

    const normalizedNextStatus = normalizeStatus(nextStatus);
    assertTransition(escrow.status, normalizedNextStatus);

    if (normalizedNextStatus === ESCROW_STATUS.RELEASED) {
      const client = await this.db.connect();

      try {
        await client.query("BEGIN");
        await this.walletService.recordEscrowRelease(escrow, client);

        const { rows } = await client.query(
          `
            UPDATE escrows
            SET status = 'RELEASED',
                released_at = NOW()
            WHERE id = $1
            RETURNING *
          `,
          [id]
        );

        await client.query("COMMIT");
        return rows[0] ?? null;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    return this.escrowRepository.updateStatus(id, normalizedNextStatus);
  }

  async markHeld(id) {
    return this.updateStatus(id, ESCROW_STATUS.HELD);
  }

  async markInspectionCompleted(id) {
    return this.markHeld(id);
  }

  async approveBuyer(id) {
    return this.updateStatus(id, ESCROW_STATUS.RELEASED);
  }

  async releaseEscrow(escrowOrId, recipientCode) {
    const escrow =
      typeof escrowOrId === "string"
        ? await this.escrowRepository.findById(escrowOrId)
        : escrowOrId;

    if (!escrow) {
      throw new Error("Escrow not found");
    }

    if (recipientCode && escrow.transaction?.amount) {
      const transfers = await this.getTransferService();
      const transfer = await transfers.prepareTransfer({
        escrow,
        recipientCode,
      });
      await transfers.sendTransfer(transfer);
    }

    return this.updateStatus(escrow.id, ESCROW_STATUS.RELEASED);
  }
}

export default new EscrowService();
