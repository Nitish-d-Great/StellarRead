/**
 * StellarRead — Stellar Transaction Verifier (Server-side)
 *
 * x402 proof verification. The backend calls this after receiving
 * x-payment-proof: <txHash> in the POST /api/articles request.
 *
 * Checks (in order):
 *   1. tx exists on Stellar Horizon
 *   2. tx.successful === true
 *   3. tx is recent (within MAX_AGE_SECONDS)
 *   4. tx contains a payment operation
 *   5. payment.destination === PUBLISHER_ADDRESS
 *   6. payment.asset_type === 'native' (XLM)
 *   7. payment.amount >= PRICE_PER_BATCH
 */

import * as StellarSdk from '@stellar/stellar-sdk';

const HORIZON_URL   = process.env.HORIZON_URL       || 'https://horizon-testnet.stellar.org';
const PUBLISHER     = process.env.PUBLISHER_ADDRESS;
const PRICE         = parseFloat(process.env.PRICE_PER_BATCH || '0.10');
const MAX_AGE_SECS  = 300; // 5 minutes

const server = new StellarSdk.Horizon.Server(HORIZON_URL);

/**
 * Verify a Stellar tx hash as valid x402 payment proof.
 * Returns { valid: true, details } or { valid: false, reason }.
 */
export async function verifyPayment(txHash) {
  // Basic sanity checks
  if (!txHash || typeof txHash !== 'string') {
    return { valid: false, reason: 'Missing or invalid tx hash' };
  }
  if (!/^[a-fA-F0-9]{64}$/.test(txHash)) {
    return { valid: false, reason: 'Invalid tx hash format (must be 64 hex chars)' };
  }
  if (!PUBLISHER) {
    return { valid: false, reason: 'Server misconfigured: PUBLISHER_ADDRESS not set' };
  }

  try {
    // ── 1. Fetch tx from Horizon ─────────────────────────────────────────
    let tx;
    try {
      tx = await server.transactions().transaction(txHash).call();
    } catch (err) {
      if (err?.response?.status === 404) {
        return { valid: false, reason: 'Transaction not found on Stellar network' };
      }
      throw err;
    }

    // ── 2. Must be successful ────────────────────────────────────────────
    if (!tx.successful) {
      return { valid: false, reason: 'Transaction failed on-chain' };
    }

    // ── 3. Must be recent ────────────────────────────────────────────────
    const ageSecs = (Date.now() - new Date(tx.created_at).getTime()) / 1000;
    if (ageSecs > MAX_AGE_SECS) {
      return { valid: false, reason: `Transaction too old (${Math.floor(ageSecs)}s). Max: ${MAX_AGE_SECS}s` };
    }

    // ── 4. Find payment operation ────────────────────────────────────────
    const ops = await server.operations().forTransaction(txHash).call();
    const payment = ops.records.find(op => op.type === 'payment');
    if (!payment) {
      return { valid: false, reason: 'No payment operation found in transaction' };
    }

    // ── 5. Correct destination ───────────────────────────────────────────
    if (payment.to !== PUBLISHER) {
      return { valid: false, reason: `Wrong payment destination. Expected publisher address.` };
    }

    // ── 6. Must be XLM (native) ──────────────────────────────────────────
    if (payment.asset_type !== 'native') {
      return { valid: false, reason: `Wrong asset. Expected XLM (native), got ${payment.asset_code}` };
    }

    // ── 7. Sufficient amount ─────────────────────────────────────────────
    const paid = parseFloat(payment.amount);
    if (paid < PRICE) {
      return { valid: false, reason: `Insufficient payment. Paid: ${paid} XLM, Required: ${PRICE} XLM` };
    }

    // ── All checks passed ────────────────────────────────────────────────
    console.log(`✅ Payment verified — Hash: ${txHash.slice(0,8)}... | ${paid} XLM | Ledger: ${tx.ledger} | ${Math.floor(ageSecs)}s ago`);

    return {
      valid: true,
      details: {
        hash:      txHash,
        from:      payment.from,
        to:        payment.to,
        amount:    paid,
        asset:     'XLM',
        ledger:    tx.ledger,
        timestamp: tx.created_at,
        ageSecs:   Math.floor(ageSecs),
      },
    };

  } catch (err) {
    console.error('Verification error:', err.message);
    return { valid: false, reason: `Verification error: ${err.message}` };
  }
}

export default { verifyPayment };
