import pool from '../config/db.js';

class TransactionRepository {

    /**
     * ============================================
     * HELPERS
     * ============================================
     */

    // Joins users + property so every fetch returns populated data
    #baseSelect = `
    SELECT
        t.*,

        -- buyer (from users)
        json_build_object(
            'id',         b.id,
            'name',       CONCAT(b.first_name, ' ', b.last_name),
            'email',      b.email,
            'phone',      b.phone_number,
            'avatar',     b.profile_image_url
        ) AS buyer,

        -- seller (business identity from sellers, joined via seller_id -> users.id -> sellers.user_id)
        json_build_object(
            'id',         se.id,
            'user_id',    se.user_id,
            'name',       se.business_name,
            'email',      se.business_email,
            'phone',      se.business_phone,
            'avatar',     se.business_profile_image_url
        ) AS seller,

        -- agent (also a seller, joined via agent_id -> users.id -> sellers.user_id)
        json_build_object(
            'id',         ag.id,
            'user_id',    ag.user_id,
            'name',       ag.business_name,
            'email',      ag.business_email,
            'phone',      ag.business_phone,
            'avatar',     ag.business_profile_image_url
        ) AS agent,

        -- property
        row_to_json(p.*) AS property

    FROM transactions t
    LEFT JOIN users     b  ON b.id       = t.buyer_id
    LEFT JOIN sellers   se ON se.user_id = t.seller_id
    LEFT JOIN sellers   ag ON ag.user_id = t.agent_id
    LEFT JOIN property  p  ON p.property_id = t.property_id
`;

    /**
     * Build a WHERE clause + values array from a plain filters object.
     * e.g. { status: 'SUCCESS', buyer_id: uuid }
     * → WHERE status = $1 AND buyer_id = $2  /  ['SUCCESS', uuid]
     */
    #buildWhere(filters, startAt = 1) {
        const keys = Object.keys(filters);
        if (!keys.length) return { clause: '', values: [] };

        const clause = 'WHERE ' + keys
            .map((k, i) => `t.${k} = $${startAt + i}`)
            .join(' AND ');

        return { clause, values: Object.values(filters) };
    }

    /**
     * ============================================
     * CREATE
     * ============================================
     */

    async create({
        reference,
        paymentType,
        propertyId   = null,
        buyerId      = null,
        sellerId     = null,
        agentId      = null,
        amount,
        currency     = 'NGN',
        gateway      = 'PAYSTACK',
        gatewayReference  = null,
        authorizationUrl  = null,
        accessCode        = null,
        status            = 'PENDING',
        gatewayResponse   = {},
    }) {
        const { rows } = await pool.query(
            `INSERT INTO transactions (
                reference, payment_type, property_id, buyer_id, seller_id,
                agent_id, amount, currency, gateway, gateway_reference,
                authorization_url, access_code, status, gateway_response
             ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13, $14
             )
             RETURNING *`,
            [
                reference, paymentType, propertyId, buyerId, sellerId,
                agentId, amount, currency, gateway, gatewayReference,
                authorizationUrl, accessCode, status,
                JSON.stringify(gatewayResponse),
            ]
        );
        return rows[0];
    }

    /**
     * ============================================
     * FIND BY ID
     * ============================================
     */

    async findById(id) {
        const { rows } = await pool.query(
            `${this.#baseSelect} WHERE t.id = $1`,
            [id]
        );
        return rows[0] ?? null;
    }

    /**
     * ============================================
     * FIND BY REFERENCE
     * ============================================
     */

    async findByReference(reference) {
        const { rows } = await pool.query(
            `${this.#baseSelect} WHERE t.reference = $1`,
            [reference]
        );
        return rows[0] ?? null;
    }

    /**
     * ============================================
     * FIND BY GATEWAY REFERENCE
     * ============================================
     */

    async findByGatewayReference(gatewayReference) {
        const { rows } = await pool.query(
            `SELECT * FROM transactions WHERE gateway_reference = $1`,
            [gatewayReference]
        );
        return rows[0] ?? null;
    }

    /**
     * ============================================
     * UPDATE STATUS
     * ============================================
     */

    async updateStatus(reference, status) {
        const { rows } = await pool.query(
            `UPDATE transactions
             SET status = $1
             WHERE reference = $2
             RETURNING *`,
            [status, reference]
        );
        return rows[0] ?? null;
    }

    /**
     * ============================================
     * UPDATE GATEWAY RESPONSE
     * ============================================
     */

    async updateGatewayResponse(reference, gatewayResponse) {
        const { rows } = await pool.query(
            `UPDATE transactions
             SET gateway_response = $1
             WHERE reference = $2
             RETURNING *`,
            [JSON.stringify(gatewayResponse), reference]
        );
        return rows[0] ?? null;
    }

    /**
     * ============================================
     * SAVE PAYSTACK INITIALIZATION DATA
     * ============================================
     */

    async saveInitialization(reference, data) {
        const { rows } = await pool.query(
            `UPDATE transactions
             SET authorization_url = $1,
                 access_code       = $2,
                 gateway_reference = $3,
                 gateway_response  = $4,
                 status            = 'INITIALIZED'
             WHERE reference = $5
             RETURNING *`,
            [
                data.authorization_url,
                data.access_code,
                data.reference,
                JSON.stringify(data),
                reference,
            ]
        );
        return rows[0] ?? null;
    }

    /**
     * ============================================
     * MARK SUCCESS
     * ============================================
     */

    async markSuccessful(reference, gatewayResponse) {
        const { rows } = await pool.query(
            `UPDATE transactions
             SET status           = 'SUCCESS',
                 gateway_response = $1
             WHERE reference = $2
             RETURNING *`,
            [JSON.stringify(gatewayResponse), reference]
        );
        return rows[0] ?? null;
    }

    /**
     * ============================================
     * MARK FAILED
     * ============================================
     */

    async markFailed(reference, gatewayResponse = {}) {
        const { rows } = await pool.query(
            `UPDATE transactions
             SET status           = 'FAILED',
                 gateway_response = $1
             WHERE reference = $2
             RETURNING *`,
            [JSON.stringify(gatewayResponse), reference]
        );
        return rows[0] ?? null;
    }

    /**
     * ============================================
     * MARK CANCELLED
     * ============================================
     */

    async markCancelled(reference) {
        const { rows } = await pool.query(
            `UPDATE transactions
             SET status = 'CANCELLED'
             WHERE reference = $1
             RETURNING *`,
            [reference]
        );
        return rows[0] ?? null;
    }

    /**
     * ============================================
     * MARK REFUNDED
     * ============================================
     */

    async markRefunded(reference, refundData) {
        const { rows } = await pool.query(
            `UPDATE transactions
             SET status           = 'REFUNDED',
                 gateway_response = gateway_response || $1::jsonb
             WHERE reference = $2
             RETURNING *`,
            [JSON.stringify({ refund: refundData }), reference]
        );
        return rows[0] ?? null;
    }

    /**
     * ============================================
     * PROPERTY TRANSACTIONS
     * ============================================
     */

    async findByProperty(propertyId) {
        const { rows } = await pool.query(
            `SELECT * FROM transactions
             WHERE property_id = $1
             ORDER BY created_at DESC`,
            [propertyId]
        );
        return rows;
    }

    /**
     * ============================================
     * BUYER HISTORY
     * ============================================
     */

    async findBuyerTransactions(buyerId) {
        const { rows } = await pool.query(
            `SELECT * FROM transactions
             WHERE buyer_id = $1
             ORDER BY created_at DESC`,
            [buyerId]
        );
        return rows;
    }

    /**
     * ============================================
     * SELLER HISTORY
     * ============================================
     */

    async findSellerTransactions(sellerId) {
        const { rows } = await pool.query(
            `SELECT * FROM transactions
             WHERE seller_id = $1
             ORDER BY created_at DESC`,
            [sellerId]
        );
        return rows;
    }

    /**
     * ============================================
     * AGENT HISTORY
     * ============================================
     */

    async findAgentTransactions(agentId) {
        const { rows } = await pool.query(
            `SELECT * FROM transactions
             WHERE agent_id = $1
             ORDER BY created_at DESC`,
            [agentId]
        );
        return rows;
    }

    /**
     * ============================================
     * FIND BY STATUS (internal helper)
     * ============================================
     */

    async #findByStatus(status) {
        const { rows } = await pool.query(
            `SELECT * FROM transactions WHERE status = $1`,
            [status]
        );
        return rows;
    }

    async findPendingTransactions()     { return this.#findByStatus('PENDING');     }
    async findSuccessfulTransactions()  { return this.#findByStatus('SUCCESS');     }
    async findInitializedTransactions() { return this.#findByStatus('INITIALIZED'); }
    async findProcessingTransactions()  { return this.#findByStatus('PROCESSING');  }

    /**
     * ============================================
     * PAGINATION
     * Filters keys must match column names exactly
     * e.g. { status: 'SUCCESS', buyer_id: uuid }
     * ============================================
     */

    async paginate({ page = 1, limit = 20, filters = {}, sort = 'created_at DESC' }) {
        const offset = (page - 1) * limit;
        const { clause, values } = this.#buildWhere(filters);

        // Whitelist sort to prevent SQL injection
        const safeSort = /^[a-z_]+ (ASC|DESC)$/i.test(sort) ? sort : 'created_at DESC';

        const dataQuery = `
            ${this.#baseSelect}
            ${clause}
            ORDER BY t.${safeSort}
            LIMIT $${values.length + 1}
            OFFSET $${values.length + 2}
        `;

        const countQuery = `
            SELECT COUNT(*) FROM transactions t
            ${clause}
        `;

        const [{ rows }, { rows: countRows }] = await Promise.all([
            pool.query(dataQuery,  [...values, limit, offset]),
            pool.query(countQuery, values),
        ]);

        const total = parseInt(countRows[0].count, 10);

        return {
            rows,
            total,
            page,
            pages: Math.ceil(total / limit),
            limit,
        };
    }

    /**
     * ============================================
     * EXISTS
     * ============================================
     */

    async exists(reference) {
        const { rows } = await pool.query(
            `SELECT 1 FROM transactions WHERE reference = $1 LIMIT 1`,
            [reference]
        );
        return rows.length > 0;
    }

    /**
     * ============================================
     * DELETE (development only)
     * ============================================
     */

    async delete(reference) {
        const { rowCount } = await pool.query(
            `DELETE FROM transactions WHERE reference = $1`,
            [reference]
        );
        return rowCount > 0;
    }

    /**
     * ============================================
     * AGGREGATE — TOTAL REVENUE
     * ============================================
     */

    async totalRevenue() {
        const { rows } = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) AS total
             FROM transactions
             WHERE status = 'SUCCESS'`
        );
        return parseFloat(rows[0].total);
    }

    /**
     * ============================================
     * AGGREGATE — TODAY'S REVENUE
     * ============================================
     */

    async todayRevenue() {
        const { rows } = await pool.query(
            `SELECT COALESCE(SUM(amount), 0) AS total
             FROM transactions
             WHERE status     = 'SUCCESS'
               AND created_at >= CURRENT_DATE
               AND created_at <  CURRENT_DATE + INTERVAL '1 day'`
        );
        return parseFloat(rows[0].total);
    }
}

export default new TransactionRepository();