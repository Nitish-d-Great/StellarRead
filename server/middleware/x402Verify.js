/**
 * StellarRead — x402 Verification Middleware
 *
 * Enforces the x402 protocol on protected routes.
 *
 * Request with NO x-payment-proof header:
 *   ← HTTP 402 + payment instructions JSON
 *
 * Request WITH x-payment-proof: <stellar_tx_hash>:
 *   → Verify tx on Stellar Horizon (via stellarVerify)
 *   → Check replay protection
 *   → Valid   → call next(), attach req.paymentDetails
 *   → Invalid → HTTP 402 + reason
 */

import { verifyPayment } from '../services/stellarVerify.js';
import { isAlreadyUsed, markAsUsed } from '../services/replayProtection.js';

const PUBLISHER    = process.env.PUBLISHER_ADDRESS;
const PRICE        = process.env.PRICE_PER_BATCH  || '0.10';
const NETWORK      = process.env.STELLAR_NETWORK  || 'TESTNET';
const ARTICLES     = process.env.ARTICLES_PER_BATCH || '10';

/**
 * Payment instructions — what the server returns on HTTP 402.
 * The client reads this, pays on Stellar, retries with proof.
 */
export function buildPaymentInstructions() {
  return {
    version:     '0.2',
    scheme:      'exact',
    network:     NETWORK === 'MAINNET' ? 'stellar' : 'stellar-testnet',
    payTo:       PUBLISHER,
    asset:       'XLM',
    amount:      PRICE,
    description: `Pay ${PRICE} XLM to unlock ${ARTICLES} news articles on StellarRead`,
    maxAgeSeconds: 300,
  };
}

/**
 * x402 middleware — attach to any route that requires payment.
 */
export function x402Required(req, res, next) {
  const proof = req.headers['x-payment-proof'];

  // ── No proof → HTTP 402 ──────────────────────────────────────────────────
  if (!proof) {
    console.log(`← HTTP 402 [no proof] ${req.method} ${req.path}`);
    return res.status(402).json({
      error: 'Payment Required',
      x402:  buildPaymentInstructions(),
    });
  }

  console.log(`→ Verifying x402 proof: ${proof.slice(0, 8)}...`);

  verifyPayment(proof)
    .then(result => {

      // ── Invalid proof → HTTP 402 + reason ─────────────────────────────
      if (!result.valid) {
        console.log(`✗ Invalid proof: ${result.reason}`);
        return res.status(402).json({
          error:  'Payment verification failed',
          reason: result.reason,
          x402:   buildPaymentInstructions(),
        });
      }

      // ── Replay check ───────────────────────────────────────────────────
      if (isAlreadyUsed(proof)) {
        console.log(`✗ Replay detected: ${proof.slice(0, 8)}...`);
        return res.status(402).json({
          error:  'Payment already used',
          reason: 'This transaction has already unlocked a batch. Please submit a new payment.',
          x402:   buildPaymentInstructions(),
        });
      }

      // ── Valid & fresh → serve content ──────────────────────────────────
      markAsUsed(proof);
      req.paymentDetails = result.details;
      console.log(`✓ x402 verified — serving content`);
      next();
    })
    .catch(err => {
      console.error('x402 middleware error:', err);
      res.status(500).json({ error: 'Verification service error', message: err.message });
    });
}

export default x402Required;
