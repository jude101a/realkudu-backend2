import pool from "../config/db.js";

const LEDGER_TYPES = Object.freeze({
  ESCROW_RELEASE: "ESCROW_RELEASE",
  COMMISSION_DEDUCTION: "COMMISSION_DEDUCTION",
});

const TRANSFER_PENDING_STATUSES = Object.freeze(["PENDING", "PROCESSING"]);

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toMoney = (value) => Math.round(toNumber(value) * 100) / 100;

const getColumn = (source = {}, camelKey, columnKey = camelKey) =>
  source[columnKey] ?? source[camelKey] ?? null;

const calculateFees = (amount) => {
  const platformFee = toMoney((amount * 2) / 100);
  const agentCommission = toMoney((amount * 1) / 100);
  const commissionTotal = toMoney(platformFee + agentCommission);
  const payoutAmount = toMoney(amount - commissionTotal);

  return {
    platformFee,
    agentCommission,
    commissionTotal,
    payoutAmount,
  };
};

const mapAccount = (row) => ({
  id: row.finance_id,
  userId: row.user_id,
  userRole: row.user_role,
  balance: toNumber(row.wallet_balance),
  commissionBalance: toNumber(row.commission_balance),
  totalEarnings: toNumber(row.total_earnings),
  totalWithdrawn: toNumber(row.total_withdrawn),
  totalPropertiesSold: toNumber(row.total_properties_sold),
  totalSalesValue: toNumber(row.total_sales_value),
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapLedgerEntry = (row) => ({
  id: row.id,
  sellerId: row.seller_id,
  type: row.entry_type,
  direction: row.direction,
  amount: toNumber(row.amount),
  balanceAfter: toNumber(row.balance_after),
  currency: row.currency,
  reference: row.reference,
  escrowId: row.escrow_id,
  transactionId: row.transaction_id,
  transferId: row.transfer_id,
  description: row.description,
  metadata: row.metadata ?? {},
  createdAt: row.created_at,
});

class WalletService {
  constructor({ db = pool } = {}) {
    this.db = db;
  }

  async ensureSchema(client = this.db) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallet_ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        entry_type VARCHAR(50) NOT NULL,
        direction VARCHAR(10) NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
        amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
        balance_after NUMERIC(15,2) NOT NULL DEFAULT 0,
        currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
        reference TEXT NOT NULL UNIQUE,
        escrow_id UUID REFERENCES escrows(id) ON DELETE SET NULL,
        transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
        transfer_id UUID REFERENCES transfers(id) ON DELETE SET NULL,
        description TEXT,
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_ledger_seller_created
      ON wallet_ledger(seller_id, created_at DESC);
    `);
  }

  async ensureAccount(sellerId, client = this.db) {
    if (!sellerId) {
      throw new Error("sellerId is required");
    }

    const { rows } = await client.query(
      `
        INSERT INTO finance_accounts (user_id, user_role)
        VALUES ($1, 'SELLER')
        ON CONFLICT (user_id)
        DO UPDATE SET
          user_role = COALESCE(finance_accounts.user_role, EXCLUDED.user_role),
          updated_at = NOW()
        RETURNING *
      `,
      [sellerId]
    );

    return rows[0];
  }

  async settleEscrowRelease(escrow) {
    const client = await this.db.connect();

    try {
      await client.query("BEGIN");
      await this.recordEscrowRelease(escrow, client);
      await client.query("COMMIT");

      const sellerId = getColumn(escrow, "sellerId", "seller_id");
      return this.getSellerWallet(sellerId);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async recordEscrowRelease(escrow, client) {
    const sellerId = getColumn(escrow, "sellerId", "seller_id");
    const escrowId = getColumn(escrow, "escrowId", "id");
    const transactionId = getColumn(escrow, "transactionId", "transaction_id");
    const amount = toMoney(
      escrow?.amount ?? escrow?.transaction?.amount ?? escrow?.transaction?.amount_paid
    );
    const currency = escrow?.transaction?.currency ?? escrow?.currency ?? "NGN";

    if (!sellerId) {
      throw new Error("sellerId is required to settle escrow release");
    }

    if (!escrowId) {
      throw new Error("escrowId is required to settle escrow release");
    }

    if (amount <= 0) {
      throw new Error("escrow release amount must be greater than zero");
    }

    const fees = calculateFees(amount);
    const releaseReference = `ESCROW-${escrowId}-RELEASE`;
    const commissionReference = `ESCROW-${escrowId}-COMMISSION`;

    await this.ensureSchema(client);
    await this.ensureAccount(sellerId, client);

    const existing = await client.query(
      `SELECT 1 FROM wallet_ledger WHERE reference = $1 LIMIT 1`,
      [releaseReference]
    );

    if (existing.rowCount) {
      return { alreadyRecorded: true };
    }

    const accountResult = await client.query(
      `
        UPDATE finance_accounts
        SET wallet_balance = wallet_balance + $2,
            total_earnings = total_earnings + $2,
            total_properties_sold = total_properties_sold + 1,
            total_sales_value = total_sales_value + $3,
            updated_at = NOW()
        WHERE user_id = $1
        RETURNING *
      `,
      [sellerId, fees.payoutAmount, amount]
    );

    const balanceAfterRelease = toMoney(
      toNumber(accountResult.rows[0].wallet_balance) + fees.commissionTotal
    );
    const balanceAfterDeduction = toMoney(accountResult.rows[0].wallet_balance);

    await client.query(
      `
        INSERT INTO wallet_ledger (
          seller_id, entry_type, direction, amount, balance_after, currency,
          reference, escrow_id, transaction_id, description, metadata
        )
        VALUES ($1, $2, 'CREDIT', $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        sellerId,
        LEDGER_TYPES.ESCROW_RELEASE,
        amount,
        balanceAfterRelease,
        currency,
        releaseReference,
        escrowId,
        transactionId,
        "Escrow released to seller wallet",
        JSON.stringify({
          payoutAmount: fees.payoutAmount,
          platformFee: fees.platformFee,
          agentCommission: fees.agentCommission,
        }),
      ]
    );

    await client.query(
      `
        INSERT INTO wallet_ledger (
          seller_id, entry_type, direction, amount, balance_after, currency,
          reference, escrow_id, transaction_id, description, metadata
        )
        VALUES ($1, $2, 'DEBIT', $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        sellerId,
        LEDGER_TYPES.COMMISSION_DEDUCTION,
        fees.commissionTotal,
        balanceAfterDeduction,
        currency,
        commissionReference,
        escrowId,
        transactionId,
        "Platform and agent commission deducted",
        JSON.stringify({
          platformFee: fees.platformFee,
          agentCommission: fees.agentCommission,
        }),
      ]
    );

    return { alreadyRecorded: false };
  }

  async getPendingPayouts(sellerId) {
    const { rows } = await this.db.query(
      `
        SELECT COALESCE(SUM(payout_amount), 0)::numeric AS total
        FROM transfers
        WHERE seller_id = $1
          AND status = ANY($2::transfer_status[])
      `,
      [sellerId, TRANSFER_PENDING_STATUSES]
    );

    return toNumber(rows[0]?.total);
  }

  async getLedgerHistory(sellerId, { page = 1, limit = 20 } = {}) {
    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const offset = (safePage - 1) * safeLimit;

    const [{ rows }, { rows: countRows }] = await Promise.all([
      this.db.query(
        `
          SELECT *
          FROM wallet_ledger
          WHERE seller_id = $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `,
        [sellerId, safeLimit, offset]
      ),
      this.db.query(
        `SELECT COUNT(*)::int AS total FROM wallet_ledger WHERE seller_id = $1`,
        [sellerId]
      ),
    ]);

    const total = countRows[0]?.total ?? 0;

    return {
      rows: rows.map(mapLedgerEntry),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: total ? Math.ceil(total / safeLimit) : 0,
    };
  }

  async getSellerWallet(sellerId, options = {}) {
    await this.ensureSchema();
    const account = await this.ensureAccount(sellerId);
    const [pendingPayouts, history] = await Promise.all([
      this.getPendingPayouts(sellerId),
      this.getLedgerHistory(sellerId, options),
    ]);

    return {
      ...mapAccount(account),
      pendingPayouts,
      availableBalance: toMoney(toNumber(account.wallet_balance) - pendingPayouts),
      history,
    };
  }
}

export { LEDGER_TYPES, WalletService };
export default new WalletService();
