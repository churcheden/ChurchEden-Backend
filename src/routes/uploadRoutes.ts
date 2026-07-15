import { Router, type RequestHandler } from "express";
import { authenticateToken } from '../middleware/auth.middleware.js';
import { deleteMutipleSource, deleteSingleSource, uploadMutipleSource, uploadSingleSource } from "../controllers/uploadController.js";
import { upload } from "../config/upload.js";

const router = Router();

router.post('/upload-single-source/:chatId',
     authenticateToken as RequestHandler, 
     upload.single('file'), 
     uploadSingleSource as RequestHandler
);

router.post('/upload-multiple-source/:chatId',
     authenticateToken as RequestHandler, 
     upload.array('files', 10), 
     uploadMutipleSource as RequestHandler,
);

router.post('/delete-single-source/:sourceId',
     authenticateToken as RequestHandler, 
     upload.single('file'), 
     deleteSingleSource as RequestHandler
);

router.post('/delete-multiple-source/:sourceId',
     authenticateToken as RequestHandler, 
     upload.array('files', 10), 
     deleteMutipleSource as RequestHandler,
);

export default router;
