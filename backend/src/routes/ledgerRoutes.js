import { Router } from 'express';
import { listLedgerHandler, getLedgerRecordHandler } from '../controllers/ledgerController.js';

const router = Router();

router.get('/', listLedgerHandler);
router.get('/:id', getLedgerRecordHandler);

export default router;
