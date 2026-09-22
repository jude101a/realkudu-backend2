// backend/routes/estateTransaction.routes.js
import { Router } from 'express';
import {
  getEstateTransactionDashboard,
  getEstateTransactionById,
  updateEstateTransactionStatus,
} from '../controllers/estate.land.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { dashboardReadLimiter, transactionWriteLimiter } from '../middlewares/rate.limiter.middleware.js';

const router = Router();

// Authentication + seller authorization happen before the controller.
// Never accept sellerId from the URL/body for authorization.
router.use(protect, requireRole('user'));

router.get(
  '/land-estate/:estateId/dashboard',
  dashboardReadLimiter,
  getEstateTransactionDashboard,
);

router.get(
  '/land-estate/:estateId/transactions/:transactionId',
  dashboardReadLimiter,
  getEstateTransactionById,
);

router.patch(
  '/land-estate/:estateId/transactions/:transactionId/status',
  transactionWriteLimiter,
  updateEstateTransactionStatus,
);

export default router;
