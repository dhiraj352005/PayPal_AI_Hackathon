import { Router } from 'express';
import { procureHandler, contractToInvoiceHandler, disputeTriageHandler } from '../controllers/agentController.js';

const router = Router();

router.post('/procure', procureHandler);
router.post('/contract-to-invoice', contractToInvoiceHandler);
router.post('/dispute-triage', disputeTriageHandler);

export default router;





