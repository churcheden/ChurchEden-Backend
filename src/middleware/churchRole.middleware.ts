import type { NextFunction, Response } from 'express';
import type { ChurchRole } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import type { AuthenticatedRequest } from './auth.middleware.js';

export type ChurchIdResolver = (req: AuthenticatedRequest) => Promise<string>;

/**
 * Guards a route so the authenticated account must be an active Admin for the
 * resolved church holding one of the allowed roles. This replaces the old
 * check against ChurchMembership.role — admin privileges now live entirely in
 * the Admin table, never in a member's ChurchMembership row.
 *
 * Only ADMIN-accountType tokens (JWT accountType === 'ADMIN') can pass; plain
 * members never hold admin roles. Throws 403 otherwise.
 */
export const requireChurchRole = (roles: ChurchRole[], resolveChurchId: ChurchIdResolver) => {
    return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
        try {
            if (req.user?.accountType !== 'ADMIN' || !req.user.adminId) {
                throw new AppError('You do not have permission to perform this action.', 403, 'FORBIDDEN');
            }

            const adminId = req.user.adminId;
            const churchId = await resolveChurchId(req);

            const admin = await prisma.admin.findFirst({
                where: { id: adminId, churchId, isActive: true },
                select: { id: true, role: true },
            });

            if (!admin || !roles.includes(admin.role)) {
                throw new AppError('You do not have permission to perform this action.', 403, 'FORBIDDEN');
            }

            // Attach the resolved churchId so downstream handlers don't re-resolve.
            (req as AuthenticatedRequest & { churchId?: string }).churchId = churchId;
            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Guards a route to SUPER_ADMIN accounts only (either in the Admin table for a
 * given church via requireChurchRole(['SUPER_ADMIN'], ...), or globally for
 * routes that resolve the church from the JWT's own church context).
 */
export const requireSuperAdmin = (resolveChurchId: ChurchIdResolver) =>
    requireChurchRole(['SUPER_ADMIN'], resolveChurchId);
