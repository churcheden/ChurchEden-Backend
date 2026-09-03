import { Router, type RequestHandler } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { requireChurchRole } from '../middleware/churchRole.middleware.js';
import { validateBody, validateQuery } from '../middleware/validation.middleware.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import {
    submitJoinRequest,
    getJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    banUser,
    unbanUser,
    cancelJoinRequest,
} from '../controllers/joinRequestController.js';
import {
    approveJoinRequestSchema,
    banUserSchema,
    cancelJoinRequestSchema,
    joinRequestsQuerySchema,
    joinRequestSchema,
    rejectJoinRequestSchema,
    unbanUserSchema,
} from '../schema/join.schema.js';

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
    if (!member) {
        throw new AppError('Join request not found!', 404, 'REQUEST_NOT_FOUND');
    }
    return member.churchId;
};

router.post('/',
    authenticateToken as RequestHandler,
    validateBody(joinRequestSchema),
    submitJoinRequest as RequestHandler,
);

router.get('/',
    authenticateToken as RequestHandler,
    validateQuery(joinRequestsQuerySchema),
    getJoinRequests as RequestHandler,
);

router.post('/cancel',
    authenticateToken as RequestHandler,
    validateBody(cancelJoinRequestSchema),
    cancelJoinRequest as RequestHandler,
);

router.post('/approve',
    authenticateToken as RequestHandler,
    validateBody(approveJoinRequestSchema),
    requireChurchRole(['ADMIN', 'SUPER_ADMIN'], resolveChurchFromMembership) as RequestHandler,
    approveJoinRequest as RequestHandler,
);

router.post('/reject',
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
