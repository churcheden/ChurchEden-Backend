import type { NextFunction, Response } from 'express';
import type { ChurchRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import type { AuthenticatedRequest } from './auth.middleware.js';

export type ChurchIdResolver = (req: AuthenticatedRequest) => Promise<string>;

/**
 * Guards a route so the authenticated account must be the SuperAdmin of the
 * resolved church holding one of the allowed roles. In the new schema, the
 * SuperAdmin is the church owner (1:1 via Church.superAdminId). Only ADMIN
 * accountType tokens (JWT accountType === 'ADMIN') can pass.
 */
export const requireChurchRole = (roles: ChurchRole[], resolveChurchId: ChurchIdResolver) => {
    return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
        try {
            if (req.user?.accountType !== 'ADMIN' || !req.user.adminId) {
                throw new AppError('You do not have permission to perform this action.', 403, 'FORBIDDEN');
            }

            const adminId = req.user.adminId;
            const churchId = await resolveChurchId(req);

            const church = await prisma.church.findUnique({
                where: { id: churchId },
                select: { superAdminId: true },
            });

            if (!church || church.superAdminId !== adminId) {
                throw new AppError('You do not have permission to perform this action.', 403, 'FORBIDDEN');
            }

            (req as AuthenticatedRequest & { churchId?: string }).churchId = churchId;
            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Guards a route to SUPER_ADMIN accounts only — the authenticated SuperAdmin
 * must own the resolved church via Church.superAdminId.
 */
export const requireSuperAdmin = (resolveChurchId: ChurchIdResolver) =>
    requireChurchRole(['SUPER_ADMIN'], resolveChurchId);
