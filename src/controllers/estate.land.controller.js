// backend/controllers/estateTransaction.controller.js
import {
  getDashboard,
  findByIdForSeller,
  getSellerIdByUserId,
  updateStatusForSeller,
} from '../models/estateTransaction.model.js';

const STATUSES = new Set(['pending', 'approved', 'completed', 'declined']);

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseUuid(value, field) {
  // PostgreSQL UUID format. Do not pass arbitrary strings into UUID queries.
  const uuid = String(value ?? '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
    throw badRequest(`Invalid ${field}`);
  }
  return uuid;
}

function parseDate(value, field) {
  if (value == null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw badRequest(`Invalid ${field}`);
  return date.toISOString();
}

function parseDashboardQuery(query) {
  const page = Math.max(1, Math.min(Number.parseInt(query.page ?? '1', 10), 100000));
  const pageSize = Math.max(
    1,
    Math.min(Number.parseInt(query.pageSize ?? '25', 10), 100),
  );

  if (!Number.isInteger(page) || !Number.isInteger(pageSize)) {
    throw badRequest('Invalid pagination');
  }

  const status = query.status ? String(query.status).trim().toLowerCase() : null;
  if (status && !STATUSES.has(status)) throw badRequest('Invalid status');

  const q = query.q ? String(query.q).trim() : null;
  if (q && q.length > 80) throw badRequest('Search query is too long');

  const from = parseDate(query.from, 'from');
  const to = parseDate(query.to, 'to');

  if (from && to && new Date(to) <= new Date(from)) {
    throw badRequest('to must be after from');
  }

  if (from && to) {
    const maxRangeMs = 366 * 24 * 60 * 60 * 1000;
    if (new Date(to) - new Date(from) > maxRangeMs) {
      throw badRequest('Date range cannot exceed 366 days');
    }
  }

  const sort = ['newest', 'oldest', 'amount_high', 'amount_low'].includes(query.sort)
    ? query.sort
    : 'newest';

  return { page, pageSize, status, q, from, to, sort };
}

function requireUserId(req) {
  const userId = req.user?.id ?? req.user?.userId ?? req.auth?.userId;
  if (!userId) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    throw error;
  }
  return userId;
}

async function resolveSeller(req) {
  const userId = requireUserId(req);
  const sellerId = await getSellerIdByUserId(userId);

  if (!sellerId) {
    const error = new Error('Seller account not found');
    error.statusCode = 403;
    throw error;
  }

  return sellerId;
}

function sendError(res, error) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  if (error.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'The requested operation conflicts with existing data',
    });
  }

  if (error.code === 'NOT_FOUND') {
    return res.status(404).json({ success: false, message: error.message });
  }

  if (error.code === 'CONFLICT') {
    return res.status(409).json({ success: false, message: error.message });
  }

  if (error.code === 'INVALID_TRANSITION') {
    return res.status(422).json({ success: false, message: error.message });
  }

  console.error('Estate transaction controller error:', error);
  return res.status(500).json({
    success: false,
    message: 'Unable to process transaction request',
  });
}

export async function getEstateTransactionDashboard(req, res) {
  try {
    const sellerId = await resolveSeller(req);
    const estateId = parseUuid(req.params.estateId, 'estateId');
    const propertyId = req.query.propertyId
      ? parseUuid(req.query.propertyId, 'propertyId')
      : null;

    const filters = parseDashboardQuery(req.query);

    const dashboard = await getDashboard({
      sellerId,
      estateId,
      propertyId,
      ...filters,
    });

    // Never expose sellerId or internal authorization details.
    return res.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getEstateTransactionById(req, res) {
  try {
    const sellerId = await resolveSeller(req);
    const estateId = parseUuid(req.params.estateId, 'estateId');
    const transactionId = parseUuid(req.params.transactionId, 'transactionId');

    const transaction = await findByIdForSeller({
      transactionId,
      sellerId,
      estateId,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function updateEstateTransactionStatus(req, res) {
  try {
    const sellerId = await resolveSeller(req);
    const estateId = parseUuid(req.params.estateId, 'estateId');
    const transactionId = parseUuid(req.params.transactionId, 'transactionId');

    const status = req.body?.status
      ? String(req.body.status).trim().toLowerCase()
      : undefined;

    const funnelStep = req.body?.funnelStep
      ? String(req.body.funnelStep).trim().toLowerCase()
      : undefined;

    const expectedVersion =
      req.body?.expectedVersion === undefined
        ? undefined
        : Number(req.body.expectedVersion);

    if (status && !STATUSES.has(status)) {
      throw badRequest('Invalid status');
    }

    if (funnelStep && funnelStep.length > 40) {
      throw badRequest('Invalid funnelStep');
    }

    if (
      expectedVersion !== undefined &&
      (!Number.isInteger(expectedVersion) || expectedVersion < 0)
    ) {
      throw badRequest('Invalid expectedVersion');
    }

    const updated = await updateStatusForSeller({
      transactionId,
      sellerId,
      estateId,
      status,
      funnelStep,
      expectedVersion,
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    return sendError(res, error);
  }
}
