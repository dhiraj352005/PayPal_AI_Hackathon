import { Router } from 'express';
import { listCatalogHandler, getProductHandler } from '../controllers/catalogController.js';

const router = Router();

router.get('/', listCatalogHandler);
router.get('/:sku', getProductHandler);

export default router;
