import { Router, type RequestHandler } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { requireChurchRole, requireSuperAdmin } from '../middleware/churchRole.middleware.js';
import { AppError } from '../utils/AppError.js';
import { validateBody, validateQuery } from '../middleware/validation.middleware.js';
import { createChurchRequest } from '../controllers/churchController.js';
import { churchRequestSchema } from '../schema/church.schema.js';
import { churchRequestLimiter } from '../middleware/rateLimiter.middleware.js';
import { prisma } from '../config/prisma.js';
import {
    deleteChurch,
    getChurchAdmins,
    leaveChurch,
    listChurches,
} from '../controllers/churchController.js';
import {
    submitJoinRequest,
    getJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    banUser,
    unbanUser,
    cancelJoinRequest,
} from '../controllers/churchController.js';
import {
    approveJoinRequestSchema,
    banUserSchema,
    cancelJoinRequestSchema,
    joinRequestsQuerySchema,
    joinRequestSchema,
    rejectJoinRequestSchema,
    unbanUserSchema,
} from '../schema/church.schema.js';

const router = Router();

const resolveChurchFromMembership = async (req: AuthenticatedRequest): Promise<string> => {
    const membershipId = (req.body as { membershipId?: string }).membershipId;
    if (!membershipId) {
        throw new AppError('Membership id is required!', 400, 'MISSING_MEMBERSHIP_ID');
    }
    const member = await prisma.member.findUnique({
        where: { id: membershipId },
        select: { churchId: true },
    });
    if (!member || !member.churchId) {
        throw new AppError('Join request not found!', 404, 'REQUEST_NOT_FOUND');
    }
    return member.churchId;
};

// POST /api/v1/church-requests - Submit a church request
router.post(
    '/create-church-request',
    authenticateToken as RequestHandler,
    churchRequestLimiter,
    validateBody(churchRequestSchema),
    createChurchRequest as RequestHandler,
);

// GET /api/v1/church/list-churches — public directory (any authenticated account).
router.get('/list-churches',
    authenticateToken as RequestHandler,
    listChurches as RequestHandler,
);

// POST /api/v1/church/:churchId/leave — member leaves an approved church.
router.post('/:churchId/leave',
    authenticateToken as RequestHandler,
    leaveChurch as RequestHandler,
);

// Resolve the target church from the URL param for the SUPER_ADMIN guard.
const resolveChurchFromParam = async (req: AuthenticatedRequest): Promise<string> => {
    const churchId = (req.params as { churchId?: string }).churchId;
    if (!churchId) {
        throw new AppError('Church id is required!', 400, 'MISSING_CHURCH_ID');
    }
    return churchId;
};

// GET /api/v1/church/:churchId/admins — ADMIN/SUPER_ADMIN only.
router.get('/:churchId/admins',
    authenticateToken as RequestHandler,
    requireChurchRole(['ADMIN', 'SUPER_ADMIN'], resolveChurchFromParam) as RequestHandler,
    getChurchAdmins as RequestHandler,
);

// DELETE /api/v1/church/:churchId — SUPER_ADMIN only.
router.delete('/:churchId',
    authenticateToken as RequestHandler,
    requireSuperAdmin(resolveChurchFromParam) as RequestHandler,
    deleteChurch as RequestHandler,
);

router.post('/submit-join-request',
    authenticateToken as RequestHandler,
    validateBody(joinRequestSchema),
    submitJoinRequest as RequestHandler,
);

router.get('/get-join-requests',
    authenticateToken as RequestHandler,
    validateQuery(joinRequestsQuerySchema),
    getJoinRequests as RequestHandler,
);

router.post('/cancel-join-request',
    authenticateToken as RequestHandler,
    validateBody(cancelJoinRequestSchema),
    cancelJoinRequest as RequestHandler,
);

router.post('/approve-join-request',
    authenticateToken as RequestHandler,
    validateBody(approveJoinRequestSchema),
    requireChurchRole(['ADMIN', 'SUPER_ADMIN'], resolveChurchFromMembership) as RequestHandler,
    approveJoinRequest as RequestHandler,
);

router.post('/reject-join-request',
    authenticateToken as RequestHandler,
    validateBody(rejectJoinRequestSchema),
    requireChurchRole(['ADMIN', 'SUPER_ADMIN'], resolveChurchFromMembership) as RequestHandler,
    rejectJoinRequest as RequestHandler,
);

router.post('/ban',
    authenticateToken as RequestHandler,
    validateBody(banUserSchema),
    requireChurchRole(['ADMIN', 'SUPER_ADMIN'], resolveChurchFromMembership) as RequestHandler,
    banUser as RequestHandler,
);

router.post('/unban',
    authenticateToken as RequestHandler,
    validateBody(unbanUserSchema),
    requireChurchRole(['ADMIN', 'SUPER_ADMIN'], resolveChurchFromMembership) as RequestHandler,
    unbanUser as RequestHandler,
);

export default router;
