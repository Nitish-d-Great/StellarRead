import express from 'express';
import { getX402 } from '../services/x402.js';

const router = express.Router();

// GET /api/facilitator/supported
router.get('/supported', async (req, res) => {
  try {
    const { facilitator } = await getX402();
    const data = await facilitator.getSupported();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'facilitator_supported_failed', message: err.message });
  }
});

// POST /api/facilitator/verify
router.post('/verify', async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body || {};
    const { facilitator } = await getX402();
    const result = await facilitator.verify(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'facilitator_verify_failed', message: err.message });
  }
});

// POST /api/facilitator/settle
router.post('/settle', async (req, res) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body || {};
    const { facilitator } = await getX402();
    const result = await facilitator.settle(paymentPayload, paymentRequirements);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'facilitator_settle_failed', message: err.message });
  }
});

export default router;

