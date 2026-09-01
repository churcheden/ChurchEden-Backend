import { Router, type RequestHandler } from 'express';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { requireChurchRole, requireSuperAdmin } from '../middleware/churchRole.middleware.js';
import { AppError } from '../utils/AppError.js';
import { deleteChurch, getChurchAdmins } from '../controllers/churchController.js';

const router = Router();

// Resolve the target church from the URL param for the SUPER_ADMIN guard.
const resolveChurchFromParam = async (req: AuthenticatedRequest): Promise<string> => {
    const churchId = (req.params as { churchId?: string }).churchId;
    if (!churchId) {
        throw new AppError('Church id is required!', 400, 'MISSING_CHURCH_ID');
    }
    return churchId;
};

// GET /api/v1/churches/:churchId/admins — ADMIN/SUPER_ADMIN only.
router.get('/:churchId/admins',
    authenticateToken as RequestHandler,
    requireChurchRole(['ADMIN', 'SUPER_ADMIN'], resolveChurchFromParam) as RequestHandler,
    getChurchAdmins as RequestHandler,
);

// DELETE /api/v1/churches/:churchId — SUPER_ADMIN only.
router.delete('/:churchId',
    authenticateToken as RequestHandler,
    requireSuperAdmin(resolveChurchFromParam) as RequestHandler,
    deleteChurch as RequestHandler,
);

export default router;
