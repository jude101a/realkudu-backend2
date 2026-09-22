

// backend/models/estateTransaction.model.js
import  pool  from '../config/db.js';

/**
 * All seller authorization is enforced here as well as in the controller.
 * The sellerId MUST come from the authenticated user, never from req.body/query.
 */

const SORT_COLUMNS = Object.freeze({
  newest: 'et.created_at DESC',
  oldest: 'et.created_at ASC',
  amount_high: 'et.amount DESC, et.created_at DESC',
  amount_low: 'et.amount ASC, et.created_at DESC',
});

function addFilter(where, params, sql, value) {
  params.push(value);
  where.push(sql.replace('$X', `$${params.length}`));
}

function buildFilters({ sellerId, estateId, propertyId, status, agentId, q, from, to }, params) {
  // filter against property_orders (alias et) and the linked property (alias e)
  const where = ['et.deleted_at IS NULL'];

  addFilter(where, params, 'et.seller_id = $X', sellerId);
  // estateId lives on the property table (e.estate_id)
  addFilter(where, params, 'e.estate_id = $X', estateId);

  if (propertyId) addFilter(where, params, 'et.property_id = $X', propertyId);
  if (status) addFilter(where, params, 'et.status = $X', status);
  if (agentId) addFilter(where, params, 'et.agent_id = $X', agentId);

  if (q) {
    params.push(`%${q}%`);
    where.push(`COALESCE(
      NULLIF(TRIM(CONCAT_WS(' ', buyer.first_name, buyer.last_name)), ''),
      buyer.name,
      ''
    ) ILIKE $${params.length}`);
  }

  if (from) addFilter(where, params, 'et.created_at >= $X::timestamptz', from);
  if (to) addFilter(where, params, 'et.created_at < $X::timestamptz', to);

  return where;
}

function baseSelect() {
  return `
    FROM property_orders et
    JOIN property e ON e.property_id = et.property_id
    LEFT JOIN users buyer ON buyer.id = et.buyer_id
    LEFT JOIN sellers agent ON agent.id = et.agent_id
  `;
}

function buyerNameSql() {
  return `COALESCE(
    NULLIF(
      TRIM(CONCAT_WS(' ', buyer.first_name, buyer.last_name)),
      ''
    ),
    'Buyer'
  )`;
}

function agentNameSql() {
  return `COALESCE(
    NULLIF(
      TRIM(CONCAT_WS(' ', agent.business_name)),
      ''
    ),
    agent.business_name,
    'Unassigned'
  )`;
}

export async function getDashboard(params) {
  const {
    sellerId,
    estateId,
    propertyId = null,
    status = null,
    agentId = null,
    q = null,
    from = null,
    to = null,
    page = 1,
    pageSize = 25,
    sort = 'newest',
  } = params;

  const queryParams = [];
  const where = buildFilters(
    { sellerId, estateId, propertyId, status, agentId, q, from, to },
    queryParams,
  );
  const whereSql = where.join(' AND ');
  const offset = (page - 1) * pageSize;

  // Count and dashboard aggregates intentionally use the exact same filters
  // as the transaction list, so the cards/charts cannot disagree with the list.
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total ${baseSelect()} WHERE ${whereSql}`,
    queryParams,
  );

  const summaryResult = await pool.query(
    `SELECT
       COUNT(*)::int AS transactions,
       COUNT(*) FILTER (WHERE et.status = 'pending')::int AS pending,
       COUNT(*) FILTER (WHERE et.status = 'approved')::int AS approved,
       COUNT(*) FILTER (WHERE et.status = 'completed')::int AS completed,
       COUNT(*) FILTER (WHERE et.status = 'declined')::int AS declined,
       COALESCE(SUM(et.agreed_amount) FILTER (WHERE et.status = 'completed'), 0)::numeric AS total_revenue,
       COALESCE(SUM(et.agreed_amount) FILTER (WHERE et.status IN ('pending','approved')), 0)::numeric AS expected_revenue,
       COALESCE(SUM(et.booking_fee) FILTER (WHERE et.status <> 'declined'), 0)::numeric AS booking_fees
     ${baseSelect()}
     WHERE ${whereSql}`,
    queryParams,
  );

  const transactionsResult = await pool.query(
    `SELECT
       et.order_id AS id,
       e.name AS estate_name,
       et.property_id,
       et.buyer_id,
       ${buyerNameSql()} AS buyer_name,
       et.agent_id,
       ${agentNameSql()} AS agent_name,
       et.funnel_step,
       et.agreed_amount::numeric AS amount,
       et.booking_fee::numeric AS booking_fee,
       et.status,
       e.quantity AS plot,
       et.docs_verified,
       et.created_at,
       et.updated_at
     ${baseSelect()}
     WHERE ${whereSql}
     ORDER BY ${SORT_COLUMNS[sort] ?? SORT_COLUMNS.newest}
     LIMIT $${queryParams.length + 1}
     OFFSET $${queryParams.length + 2}`,
    [...queryParams, pageSize, offset],
  );

  const funnelResult = await pool.query(
    `SELECT
       et.purchase_step,
       COUNT(*)::int AS count
     ${baseSelect()}
     WHERE ${whereSql}
     GROUP BY et.purchase_step`,
    queryParams,
  );

  const agentsResult = await pool.query(
    `SELECT
       et.agent_id,
       ${agentNameSql()} AS agent_name,
       COUNT(*) FILTER (WHERE et.status = 'completed')::int AS sales,
       COALESCE(SUM(et.agreed_amount), 0)::numeric AS revenue
     ${baseSelect()}
     WHERE ${whereSql}
     GROUP BY et.agent_id, ${agentNameSql()}
     ORDER BY revenue DESC`,
    queryParams,
  );

  // Plot state is derived from the transaction ledger, not from Flutter's local DB.
  // "blocked" is stored independently so an unavailable plot is not mistaken for a sale.
  const plotResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE p.status = 'available')::int AS available,
       COUNT(*) FILTER (WHERE p.status = 'reserved')::int AS reserved,
       COUNT(*) FILTER (WHERE p.status = 'sold')::int AS sold,
       COUNT(*) FILTER (WHERE p.status = 'blocked')::int AS blocked,
       COUNT(*)::int AS total
     FROM property_orders p
     WHERE p.property_id = $1
       AND p.deleted_at IS NULL`,
    [estateId],
  );

  const summary = summaryResult.rows[0];
  const bookingFees = Number(summary.booking_fees ?? 0);

  return {
    pagination: {
      page,
      pageSize,
      total: countResult.rows[0].total,
      hasNext: offset + transactionsResult.rows.length < countResult.rows[0].total,
    },
    summary: {
      transactions: summary.transactions,
      pending: summary.pending,
      approved: summary.approved,
      completed: summary.completed,
      declined: summary.declined,
      totalRevenue: Number(summary.total_revenue ?? 0),
      expectedRevenue: Number(summary.expected_revenue ?? 0),
      bookingFees,
      // No unsupported "profit" accounting is invented here.
      // Until actual seller costs are modeled, profit equals recorded booking fees.
      profit: bookingFees,
    },
    funnel: funnelResult.rows.map((r) => ({
      step: r.funnel_step,
      count: Number(r.count),
    })),
    agents: agentsResult.rows.map((r) => ({
      agentId: r.agent_id,
      agent: r.agent_name,
      sales: Number(r.sales),
      revenue: Number(r.revenue),
    })),
    plots: {
      total: Number(plotResult.rows[0]?.total ?? 0),
      available: Number(plotResult.rows[0]?.available ?? 0),
      reserved: Number(plotResult.rows[0]?.reserved ?? 0),
      sold: Number(plotResult.rows[0]?.sold ?? 0),
      blocked: Number(plotResult.rows[0]?.blocked ?? 0),
    },
    transactions: transactionsResult.rows.map((r) => ({
      id: r.id,
      estateName: r.estate_name,
      propertyId: r.property_id,
      buyerId: r.buyer_id,
      buyerName: r.buyer_name,
      agentId: r.agent_id,
      agent: r.agent_name,
      funnelStep: r.funnel_step,
      amount: Number(r.amount),
      bookingFee: Number(r.booking_fee),
      status: r.status,
      plot: r.plot,
      docsVerified: r.docs_verified,
      date: r.created_at,
      updatedAt: r.updated_at,
    })),
  };
}

export async function findByIdForSeller({ transactionId, sellerId, estateId }) {
  const result = await pool.query(
    `SELECT
       et.order_id AS id,
       e.estate_id AS estate_id,
       e.name AS estate_name,
       et.property_id,
       et.buyer_id,
       ${buyerNameSql()} AS buyer_name,
       et.agent_id,
       ${agentNameSql()} AS agent_name,
       et.funnel_step,
       et.agreed_amount::numeric AS amount,
       et.booking_fee::numeric AS booking_fee,
       et.status,
       NULLIF(et.name, '') AS plot,
       et.docs_verified,
       et.created_at,
       et.updated_at,
       et.version
     ${baseSelect()}
     WHERE et.order_id = $1
       AND et.seller_id = $2
       AND e.estate_id = $3
       AND et.deleted_at IS NULL
     LIMIT 1`,
    [transactionId, sellerId, estateId],
  );

  return result.rows[0] ?? null;
}

export async function updateStatusForSeller({
  transactionId,
  sellerId,
  estateId,
  status,
  funnelStep,
  expectedVersion,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query(
      `SELECT id, status, purchase_step, version
       FROM orders
       WHERE id = $1 AND seller_id = $2 AND estate_id = $3 AND deleted_at IS NULL
       FOR UPDATE`,
      [transactionId, sellerId, estateId],
    );

    if (!current.rowCount) {
      const error = new Error('Transaction not found');
      error.code = 'NOT_FOUND';
      throw error;
    }

    const row = current.rows[0];

    if (expectedVersion !== undefined && row.version !== expectedVersion) {
      const error = new Error('Transaction changed; refresh before updating');
      error.code = 'CONFLICT';
      throw error;
    }

    // Never allow arbitrary state jumps from the client.
    const allowedTransitions = {
      pending: ['approved', 'declined'],
      approved: ['completed', 'declined'],
      completed: [],
      declined: [],
    };

    if (status && !allowedTransitions[row.status]?.includes(status)) {
      const error = new Error(`Invalid status transition: ${row.status} -> ${status}`);
      error.code = 'INVALID_TRANSITION';
      throw error;
    }

    const nextStatus = status ?? row.status;
    const nextFunnel = funnelStep ?? row.funnel_step;

    const updated = await client.query(
      `UPDATE orders
       SET status = $1,
           purchase_step = $2,
           version = version + 1,
           updated_at = NOW(),
           completed_at = CASE
             WHEN $1 = 'completed' THEN COALESCE(completed_at, NOW())
             ELSE completed_at
           END
       WHERE id = $3 AND seller_id = $4 AND estate_id = $5
       RETURNING id, status, purchase_step, version, updated_at`,
      [nextStatus, nextFunnel, transactionId, sellerId, estateId],
    );

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
 