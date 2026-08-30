import { Router, type RequestHandler } from 'express';
import { createChurchRequest } from '../controllers/churchRequestController.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { churchRequestSchema } from '../schema/church-request.schema.js';
import { churchRequestLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

// POST /api/v1/church-requests - Submit a church request
router.post(
    '/',
    authenticateToken as RequestHandler,
    churchRequestLimiter,
    validateBody(churchRequestSchema),
    createChurchRequest as RequestHandler,
);

export default router;