import pool from "../config/db.js";

class EscrowRepository {

    /**
     * ============================================
     * HELPERS
     * ============================================
     */

    #baseSelect = `
        SELECT
            e.*,

            row_to_json(b.*) AS buyer,
            row_to_json(se.*) AS seller,
            row_to_json(a.*) AS agent,

            -- property
            row_to_json(p.*)  AS property,

            -- transaction
            row_to_json(tr.*) AS transaction

        FROM escrows e
        LEFT JOIN users        b  ON b.id  = e.buyer_id
        LEFT JOIN users        se ON se.id = e.seller_id
        LEFT JOIN users        a  ON a.id  = e.agent_id
        LEFT JOIN property     p  ON p.property_id = e.property_id
        LEFT JOIN transactions tr ON tr.id = e.transaction_id
    `;

    /**
     * ============================================
     * CREATE
     * ============================================
     */

    async create({
        transactionId,
        propertyId  = null,
        buyerId     = null,
        sellerId    = null,
        agentId     = null,
        status      = 'PENDING',
    }) {
        const { rows } = await pool.query(
            `INSERT INTO escrows (
                transaction_id, property_id, buyer_id, seller_id, agent_id, status
             ) VALUES (
                $1, $2, $3, $4, $5, $6
             )
             RETURNING *`,
            [transactionId, propertyId, buyerId, sellerId, agentId, status]
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
            `${this.#baseSelect}
             WHERE e.id = $1`,
            [id]
        );
        return rows[0] ?? null;
    }

    /**
     * ============================================
     * FIND BY TRANSACTION
     * ============================================
     */

    async findByTransaction(transactionId) {
        const { rows } = await pool.query(
            `${this.#baseSelect}
             WHERE e.transaction_id = $1`,
            [transactionId]
        );
        return rows[0] ?? null;
    }

    /**
     * ============================================
     * FIND BY PROPERTY
     * ============================================
     */

    async findByProperty(propertyId) {
        const { rows } = await pool.query(
            `SELECT * FROM escrows WHERE property_id = $1`,
            [propertyId]
        );
        return rows[0] ?? null;
    }

    /**
     * ============================================
     * UPDATE STATUS
     * ============================================
     */

    async updateStatus(id, status) {
        const { rows } = await pool.query(
            `UPDATE escrows
             SET status = $1
             WHERE id = $2
             RETURNING *`,
            [status, id]
        );
        return rows[0] ?? null;
    }

    /**
     * ============================================
     * RELEASE
     * ============================================
     */

    async release(id) {
        const { rows } = await pool.query(
            `UPDATE escrows
             SET status      = 'RELEASED',
                 released_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );
        return rows[0] ?? null;
    }
}

export default new EscrowRepository();
