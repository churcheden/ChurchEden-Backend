import { Router, type RequestHandler, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import {
    saveOnboardingStep1,
    saveOnboardingStep2,
    saveOnboardingStep3,
    saveOnboardingStep4,
    getOnboardingDraft,
    completeChurchOnboarding,
} from '../controllers/onboardingController.js';
import { step1Schema, step2Schema, step3Schema, step4Schema } from '../schema/onboarding.schema.js';
import { AppError } from '../utils/AppError.js';

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

router.patch('/step-1',
    authenticateToken as RequestHandler,
    validateBody(step1Schema),
    saveOnboardingStep1 as RequestHandler,
);

router.patch('/step-2',
    authenticateToken as RequestHandler,
    validateBody(step2Schema),
    saveOnboardingStep2 as RequestHandler,
);

router.patch('/step-3',
    authenticateToken as RequestHandler,
    handleLogoUpload,
    validateBody(step3Schema),
    saveOnboardingStep3 as RequestHandler,
);

router.patch('/step-4',
    authenticateToken as RequestHandler,
    validateBody(step4Schema),
    saveOnboardingStep4 as RequestHandler,
);

router.get('/draft',
    authenticateToken as RequestHandler,
    getOnboardingDraft as RequestHandler,
);

router.post('/complete',
    authenticateToken as RequestHandler,
    completeChurchOnboarding as RequestHandler,
);

export default router;