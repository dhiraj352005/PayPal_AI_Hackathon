import { Router } from 'express';
import { getHealthHandler, updateCredentialsHandler } from '../controllers/configController.js';

const router = Router();

router.get('/status', getHealthHandler);
router.post('/credentials', updateCredentialsHandler);

export default router;
