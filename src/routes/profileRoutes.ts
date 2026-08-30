import { Router, type RequestHandler, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { completeProfileSchema } from '../schema/profile.schema.js';
import { completeProfile, getProfile } from '../controllers/profileController.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadProfilePhoto = upload.single('profilePhoto');

const handleUpload = (req: Request, res: Response, next: NextFunction) => {
    uploadProfilePhoto(req, res, (err: unknown) => {
        if (err) {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return next(new AppError('Profile photo must be 5MB or smaller.', 400, 'PHOTO_TOO_LARGE'));
            };
            return next(err);
        };
        next();
    });
};

router.post('/profile/complete',
    authenticateToken as RequestHandler,
    handleUpload,
    validateBody(completeProfileSchema),
    completeProfile as RequestHandler,
);

router.get('/profile',
    authenticateToken as RequestHandler,
    getProfile as RequestHandler,
);

export default router;