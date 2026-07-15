import { Router, type RequestHandler } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { cancelSubscription, initializePayment, verifyPayment } from '../controllers/paymentController.js';
import { handlePaymentEvent } from '../webhooks/paystack.webhooks.js';

const router = Router();

router.get('/initialize', authenticateToken as RequestHandler, initializePayment as RequestHandler);
router.get('/initialize/verify/:reference', authenticateToken as RequestHandler, verifyPayment as RequestHandler);
router.get('/subscription/cancel', authenticateToken as RequestHandler, cancelSubscription as RequestHandler);
router.post('/webhooks/paystack', handlePaymentEvent);

export default router;
