// backend/models/estateTransaction.model.js

import pool from '../config/db.js';

const SORT_COLUMNS = Object.freeze({
  newest: 'et.created_at DESC',
  oldest: 'et.created_at ASC',
  amount_high: 'amount DESC, et.created_at DESC',
  amount_low: 'amount ASC, et.created_at DESC',
});

function landUnitPriceSql(alias = 'e') {
  return `
    COALESCE(
      NULLIF(${alias}.price_per_plot, 0),
      NULLIF(${alias}.price, 0),
      NULLIF(${alias}.asking_price, 0),
      NULLIF(${alias}.final_sale_price, 0),
      0
    )
  `;
}

function orderPlotQuantitySql(alias = 'et') {
  return `
    COALESCE(
      NULLIF(${alias}.quantity, 0),
      1
    )
  `;
}

function orderAmountSql(orderAlias = 'et', propertyAlias = 'e') {
  return `
    COALESCE(
      NULLIF(${orderAlias}.agreed_amount, 0),
      ${orderPlotQuantitySql(orderAlias)}
      * ${landUnitPriceSql(propertyAlias)}
    )
  `;
}

function addFilter(where, params, sql, value) {
  params.push(value);
  where.push(sql.replace('$X', `$${params.length}`));
}

function buildFilters(
  {
    sellerId,
    estateId,
    propertyId,
    status,
    agentId,
    q,
    from,
    to,
  },
  params,
) {
  const where = [
    'et.deleted_at IS NULL',
    'e.deleted_at IS NULL',
  ];

  addFilter(where, params, 'e.seller_id = $X', sellerId);
  addFilter(where, params, 'e.estate_id = $X', estateId);

  if (propertyId) {
    addFilter(where, params, 'et.property_id = $X', propertyId);
  }

  if (status) {
    addFilter(where, params, 'et.status = $X', status);
  }

  if (agentId) {
    addFilter(where, params, 'et.agent_id = $X', agentId);
  }

  if (q) {
    params.push(`%${q}%`);

    where.push(`
      COALESCE(
        NULLIF(
          TRIM(CONCAT_WS(' ', buyer.first_name, buyer.last_name)),
          ''
        ),
        buyer.name,
        ''
      ) ILIKE $${params.length}
    `);
  }

  if (from) {
    addFilter(
      where,
      params,
      'et.created_at >= $X::timestamptz',
      from,
    );
  }

  if (to) {
    addFilter(
      where,
      params,
      'et.created_at < $X::timestamptz',
      to,
    );
  }

  return where;
}

function baseSelect() {
  return `
    FROM property e
    JOIN property_orders et
      ON e.property_id = et.property_id
    LEFT JOIN users buyer
      ON buyer.id = et.buyer_id
    LEFT JOIN sellers agent
      ON agent.id = et.agent_id
  `;
}

function buyerNameSql() {
  return `
    COALESCE(
      NULLIF(
        TRIM(CONCAT_WS(' ', buyer.first_name, buyer.last_name)),
        ''
      ),
      'Buyer'
    )
  `;
}

function agentNameSql() {
  return `
    COALESCE(
      NULLIF(
        TRIM(agent.business_name),
        ''
      ),
      agent.business_name,
      'Unassigned'
    )
  `;
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
    {
      sellerId,
      estateId,
      propertyId,
      status,
      agentId,
      q,
      from,
      to,
    },
    queryParams,
  );

  const whereSql = where.join(' AND ');
  const offset = (page - 1) * pageSize;
  const unitPriceSql = landUnitPriceSql('e');
  const orderAmount = orderAmountSql('et', 'e');
  const orderPlotQuantity = orderPlotQuantitySql('et');

  const countResult = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      ${baseSelect()}
      WHERE ${whereSql}
    `,
    queryParams,
  );

  const summaryResult = await pool.query(
    `
      SELECT
        COUNT(*)::int AS transactions,

        COUNT(*) FILTER (
          WHERE et.status = 'pending'
        )::int AS pending,

        COUNT(*) FILTER (
          WHERE et.status = 'approved'
        )::int AS approved,

        COUNT(*) FILTER (
          WHERE et.status = 'completed'
        )::int AS completed,

        COUNT(*) FILTER (
          WHERE et.status = 'declined'
        )::int AS declined,

        COALESCE(
          SUM(
            ${orderAmount}
          ) FILTER (
            WHERE et.status = 'completed'
          ),
          0
        )::numeric AS total_revenue,

        COALESCE(
          SUM(et.booking_fee) FILTER (
            WHERE et.status <> 'declined'
          ),
          0
        )::numeric AS booking_fees

      ${baseSelect()}
      WHERE ${whereSql}
    `,
    queryParams,
  );

  const inventoryParams = [sellerId, estateId];

  let propertyFilter = `
    e.seller_id = $1
    AND e.estate_id = $2
    AND e.deleted_at IS NULL
  `;

  if (propertyId) {
    inventoryParams.push(propertyId);

    propertyFilter += `
      AND e.property_id = $${inventoryParams.length}
    `;
  }

  const inventoryResult = await pool.query(
    `
      SELECT
        COALESCE(
          SUM(e.quantity),
          0
        )::numeric AS total_plots,

        COALESCE(
          SUM(
            COALESCE(e.quantity, 0)
            * ${unitPriceSql}
          ),
          0
        )::numeric AS expected_revenue

      FROM property e

      WHERE ${propertyFilter}
    `,
    inventoryParams,
  );

  const plotParams = [sellerId, estateId];

  let plotPropertyFilter = `
    e.seller_id = $1
    AND e.estate_id = $2
    AND e.deleted_at IS NULL
  `;

  if (propertyId) {
    plotParams.push(propertyId);

    plotPropertyFilter += `
      AND e.property_id = $${plotParams.length}
    `;
  }

  const plotResult = await pool.query(
    `
      SELECT
        COALESCE(
          SUM(e.quantity),
          0
        )::numeric AS total,

        COALESCE(
          SUM(e.quantity)
          -
          COALESCE(
            SUM(order_totals.ordered_quantity),
            0
          ),
          0
        )::numeric AS available,

        COALESCE(
          SUM(order_totals.reserved_quantity),
          0
        )::numeric AS reserved,

        COALESCE(
          SUM(order_totals.sold_quantity),
          0
        )::numeric AS sold

      FROM property e

      LEFT JOIN (
        SELECT
          et.property_id,

          COALESCE(
            SUM(${orderPlotQuantity}) FILTER (
              WHERE et.status <> 'declined'
            ),
            0
          ) AS ordered_quantity,

          COALESCE(
            SUM(${orderPlotQuantity}) FILTER (
              WHERE et.status = 'pending'
            ),
            0
          ) AS reserved_quantity,

          COALESCE(
            SUM(${orderPlotQuantity}) FILTER (
              WHERE et.status = 'completed'
            ),
            0
          ) AS sold_quantity

        FROM property_orders et

        WHERE et.deleted_at IS NULL

        GROUP BY et.property_id
      ) order_totals
        ON order_totals.property_id = e.property_id

      WHERE ${plotPropertyFilter}
    `,
    plotParams,
  );

  const transactionsResult = await pool.query(
    `
      SELECT
        et.order_id AS id,
        e.name AS estate_name,
        et.property_id,
        et.buyer_id,
        ${buyerNameSql()} AS buyer_name,
        et.agent_id,
        ${agentNameSql()} AS agent_name,
        et.funnel_step,
        et.payment_type,
        et.currency,
        ${orderAmount}::numeric AS amount,
        et.booking_fee::numeric AS booking_fee,
        et.status,
        ${orderPlotQuantity}::numeric AS plot,
        et.docs_verified,
        et.created_at,
        et.updated_at

      ${baseSelect()}

      WHERE ${whereSql}

      ORDER BY ${SORT_COLUMNS[sort] ?? SORT_COLUMNS.newest}

      LIMIT $${queryParams.length + 1}
      OFFSET $${queryParams.length + 2}
    `,
    [
      ...queryParams,
      pageSize,
      offset,
    ],
  );

  const funnelResult = await pool.query(
    `
      SELECT
        et.purchase_step,
        COUNT(*)::int AS count

      ${baseSelect()}

      WHERE ${whereSql}

      GROUP BY et.purchase_step
    `,
    queryParams,
  );

  const agentsResult = await pool.query(
    `
      SELECT
        et.agent_id,
        ${agentNameSql()} AS agent_name,

        COUNT(*) FILTER (
          WHERE et.status = 'completed'
        )::int AS sales,

        COALESCE(
          SUM(
            ${orderAmount}
          ) FILTER (
            WHERE et.status = 'completed'
          ),
          0
        )::numeric AS revenue

      ${baseSelect()}

      WHERE ${whereSql}

      GROUP BY
        et.agent_id,
        ${agentNameSql()}

      ORDER BY revenue DESC
    `,
    queryParams,
  );

  const summary = summaryResult.rows[0];
  const inventory = inventoryResult.rows[0];
  const plots = plotResult.rows[0];

  const bookingFees = Number(
    summary?.booking_fees ?? 0,
  );

  const totalPlots = Number(
    inventory?.total_plots ?? 0,
  );

  const expectedRevenue = Number(
    inventory?.expected_revenue ?? 0,
  );

  const reservedPlots = Number(
    plots?.reserved ?? 0,
  );

  const soldPlots = Number(
    plots?.sold ?? 0,
  );

  const availablePlots = Math.max(
    0,
    Number(plots?.available ?? 0),
  );

  return {
    pagination: {
      page,
      pageSize,
      total: countResult.rows[0].total,
      hasNext:
        offset + transactionsResult.rows.length <
        countResult.rows[0].total,
    },

    summary: {
      transactions: Number(
        summary?.transactions ?? 0,
      ),
      pending: Number(
        summary?.pending ?? 0,
      ),
      approved: Number(
        summary?.approved ?? 0,
      ),
      completed: Number(
        summary?.completed ?? 0,
      ),
      declined: Number(
        summary?.declined ?? 0,
      ),
      totalRevenue: Number(
        summary?.total_revenue ?? 0,
      ),
      expectedRevenue,
      bookingFees,
      profit: bookingFees,
    },

    funnel: funnelResult.rows.map((r) => ({
      step: r.purchase_step,
      count: Number(r.count),
    })),

    agents: agentsResult.rows.map((r) => ({
      agentId: r.agent_id,
      agent: r.agent_name,
      sales: Number(r.sales),
      revenue: Number(r.revenue),
    })),

    plots: {
      total: totalPlots,
      available: availablePlots,
      reserved: reservedPlots,
      sold: soldPlots,
      blocked: 0,
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
      paymentType: r.payment_type,
      currency: r.currency,
      amount: Number(r.amount),
      bookingFee: Number(r.booking_fee),
      status: r.status,
      plot: Number(r.plot),
      docsVerified: r.docs_verified,
      date: r.created_at,
      updatedAt: r.updated_at,
    })),
  };
}

export async function findByIdForSeller({
  transactionId,
  sellerId,
  estateId,
}) {
  const orderAmount = orderAmountSql('et', 'e');
  const orderPlotQuantity = orderPlotQuantitySql('et');

  const result = await pool.query(
    `
      SELECT
        et.order_id AS id,
        e.estate_id AS estate_id,
        e.name AS estate_name,
        et.property_id,
        et.property_type,
        et.buyer_id,
        ${buyerNameSql()} AS buyer_name,
        et.agent_id,
        ${agentNameSql()} AS agent_name,
        et.lawyer_id,
        et.funnel_step,
        et.purchase_step,
        et.payment_type,
        et.currency,
        ${orderAmount}::numeric AS amount,
        et.booking_fee::numeric AS booking_fee,
        et.amount_paid::numeric AS amount_paid,
        et.status,
        ${orderPlotQuantity}::numeric AS plot,
        et.inspection_required,
        et.inspection_completed,
        et.due_diligence_completed,
        et.agreement_signed,
        et.government_consent_required,
        et.docs_verified,
        et.notes,
        et.created_at,
        et.updated_at,
        et.completed_at,
        et.cancelled_at,
        et.version

      ${baseSelect()}

      WHERE et.order_id = $1
        AND e.seller_id = $2
        AND e.estate_id = $3
        AND et.deleted_at IS NULL
        AND e.deleted_at IS NULL

      LIMIT 1
    `,
    [
      transactionId,
      sellerId,
      estateId,
    ],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    estateId: row.estate_id,
    estateName: row.estate_name,
    propertyId: row.property_id,
    propertyType: row.property_type,
    buyerId: row.buyer_id,
    buyerName: row.buyer_name,
    agentId: row.agent_id,
    agent: row.agent_name,
    lawyerId: row.lawyer_id,
    funnelStep: row.funnel_step,
    purchaseStep: row.purchase_step,
    paymentType: row.payment_type,
    currency: row.currency,
    amount: Number(row.amount),
    bookingFee: Number(row.booking_fee),
    amountPaid: Number(row.amount_paid),
    status: row.status,
    plot: Number(row.plot),
    inspectionRequired: row.inspection_required,
    inspectionCompleted: row.inspection_completed,
    dueDiligenceCompleted: row.due_diligence_completed,
    agreementSigned: row.agreement_signed,
    governmentConsentRequired: row.government_consent_required,
    docsVerified: row.docs_verified,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    version: row.version,
  };
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
      `
        SELECT
          et.order_id AS id,
          et.status,
          et.funnel_step,
          et.version

        FROM property_orders et

        JOIN property e
          ON e.property_id = et.property_id

        WHERE et.order_id = $1
          AND e.seller_id = $2
          AND e.estate_id = $3
          AND et.deleted_at IS NULL
          AND e.deleted_at IS NULL

        FOR UPDATE
      `,
      [
        transactionId,
        sellerId,
        estateId,
      ],
    );

    if (!current.rowCount) {
      const error = new Error(
        'Transaction not found',
      );

      error.code = 'NOT_FOUND';

      throw error;
    }

    const row = current.rows[0];

    if (
      expectedVersion !== undefined &&
      row.version !== expectedVersion
    ) {
      const error = new Error(
        'Transaction changed; refresh before updating',
      );

      error.code = 'CONFLICT';

      throw error;
    }

    const allowedTransitions = {
      pending: ['approved', 'declined'],
      approved: ['completed', 'declined'],
      completed: [],
      declined: [],
    };

    if (
      status &&
      !allowedTransitions[row.status]?.includes(status)
    ) {
      const error = new Error(
        `Invalid status transition: ${row.status} -> ${status}`,
      );

      error.code = 'INVALID_TRANSITION';

      throw error;
    }

    const nextStatus = status ?? row.status;
    const nextFunnel = funnelStep ?? row.funnel_step;

    const updated = await client.query(
      `
        UPDATE property_orders

        SET
          status = $1,
          funnel_step = $2,
          version = version + 1,
          updated_at = NOW(),
          completed_at = CASE
            WHEN $1 = 'completed'
              THEN COALESCE(completed_at, NOW())
            ELSE completed_at
          END,
          cancelled_at = CASE
            WHEN $1 = 'declined'
              THEN COALESCE(cancelled_at, NOW())
            ELSE cancelled_at
          END

        WHERE order_id = $3
          AND property_id IN (
            SELECT property_id
            FROM property
            WHERE seller_id = $4
              AND estate_id = $5
              AND deleted_at IS NULL
          )

        RETURNING
          order_id AS id,
          status,
          funnel_step,
          version,
          updated_at,
          completed_at,
          cancelled_at
      `,
      [
        nextStatus,
        nextFunnel,
        transactionId,
        sellerId,
        estateId,
      ],
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