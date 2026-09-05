import { Router, type RequestHandler, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { step1Schema, step2Schema, step3Schema, step4Schema } from '../schema/onboarding.schema.js';
import { AppError } from '../utils/AppError.js';
import { completeProfileSchema } from '../schema/onboarding.schema.js';
import { completeProfile, getProfile } from '../controllers/onboardingController.js';
import {
    saveOnboardingStep1,
    saveOnboardingStep2,
    saveOnboardingStep3,
    saveOnboardingStep4,
    getOnboardingDraft,
    completeChurchOnboarding,
} from '../controllers/onboardingController.js';

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadChurchLogo = upload.single('logo');

const handleLogoUpload = (req: Request, res: Response, next: NextFunction) => {
    uploadChurchLogo(req, res, (err: unknown) => {
        if (err) {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return next(new AppError('Church logo must be 5MB or smaller.', 400, 'LOGO_TOO_LARGE'));
            }
            return next(err);
        }
        next();
    });
};

router.patch('/save-onboarding-step-1',
    authenticateToken as RequestHandler,
    validateBody(step1Schema),
    saveOnboardingStep1 as RequestHandler,
);

router.patch('/save-onboarding-step-2',
    authenticateToken as RequestHandler,
    validateBody(step2Schema),
    saveOnboardingStep2 as RequestHandler,
);

router.patch('/save-onboarding-step-3',
    authenticateToken as RequestHandler,
    handleLogoUpload,
    validateBody(step3Schema),
    saveOnboardingStep3 as RequestHandler,
);

router.patch('/save-onboarding-step-4',
    authenticateToken as RequestHandler,
    validateBody(step4Schema),
    saveOnboardingStep4 as RequestHandler,
);

router.get('/get-onboarding-draft',
    authenticateToken as RequestHandler,
    getOnboardingDraft as RequestHandler,
);

router.post('/complete-church-onboarding',
    authenticateToken as RequestHandler,
    completeChurchOnboarding as RequestHandler,
);

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

router.post('/complete-profile',
    authenticateToken as RequestHandler,
    handleUpload,
    validateBody(completeProfileSchema),
    completeProfile as RequestHandler,
);

router.get('/get-profile',
    authenticateToken as RequestHandler,
    getProfile as RequestHandler,
);

export default router;